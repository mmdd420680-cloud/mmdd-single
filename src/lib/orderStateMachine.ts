export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type FulfillmentStatus =
  | 'unfulfilled'
  | 'packing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned', 'delivered'],
  returned: [],
  cancelled: [],
};

export function canTransitionOrderStatus(params: {
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
  paymentMethod: 'cod' | 'sslcommerz' | 'bkash' | 'nagad' | 'card';
  paymentStatus: PaymentStatus;
}): { allowed: boolean; reason?: string } {
  if (params.currentStatus === params.nextStatus) {
    return { allowed: false, reason: `Order is already ${params.currentStatus}.` };
  }

  const allowedNext = ORDER_TRANSITIONS[params.currentStatus] || [];
  if (!allowedNext.includes(params.nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition order from "${params.currentStatus}" to "${params.nextStatus}".`,
    };
  }

  // Online prepaid orders must be paid before packing or shipping
  if (
    params.paymentMethod !== 'cod' &&
    (params.nextStatus === 'processing' || params.nextStatus === 'packed' || params.nextStatus === 'shipped') &&
    params.paymentStatus !== 'paid'
  ) {
    return {
      allowed: false,
      reason: 'Online payment must be verified as paid before processing or shipping.',
    };
  }

  return { allowed: true };
}

export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CancellationRequestSummary {
  status: CancellationRequestStatus;
  reason: string;
  message?: string;
  orderStatusAtRequest?: string;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  adminNotes?: string;
}

export type OrderCancellationMode =
  | 'direct_cancel'
  | 'request_cancellation'
  | 'pending_review'
  | 'shipped_blocked'
  | 'return_only'
  | 'already_cancelled'
  | 'none';

export function canCustomerCancelOrder(status: OrderStatus): boolean {
  return status === 'pending';
}

export function canCustomerRequestCancellation(
  status: OrderStatus,
  cancellationRequest?: Pick<CancellationRequestSummary, 'status'> | null,
): boolean {
  if (!['confirmed', 'processing', 'packed'].includes(status)) return false;
  return cancellationRequest?.status !== 'pending';
}

export function getOrderCancellationEligibility(params: {
  orderStatus: OrderStatus;
  cancellationRequest?: CancellationRequestSummary | null;
  deliveredAt?: Date | string | null;
  now?: Date;
}): {
  mode: OrderCancellationMode;
  message: string;
  canDirectCancel: boolean;
  canRequestCancellation: boolean;
  canRequestReturn: boolean;
} {
  const { orderStatus, cancellationRequest, deliveredAt, now = new Date() } = params;

  if (orderStatus === 'cancelled') {
    return {
      mode: 'already_cancelled',
      message: 'This order has been cancelled.',
      canDirectCancel: false,
      canRequestCancellation: false,
      canRequestReturn: false,
    };
  }

  if (orderStatus === 'pending') {
    return {
      mode: 'direct_cancel',
      message: 'This order is still pending and can be cancelled immediately.',
      canDirectCancel: true,
      canRequestCancellation: false,
      canRequestReturn: false,
    };
  }

  if (['confirmed', 'processing', 'packed'].includes(orderStatus)) {
    if (cancellationRequest?.status === 'pending') {
      return {
        mode: 'pending_review',
        message: 'Your cancellation request is under admin review.',
        canDirectCancel: false,
        canRequestCancellation: false,
        canRequestReturn: false,
      };
    }
    return {
      mode: 'request_cancellation',
      message:
        cancellationRequest?.status === 'rejected'
          ? 'Your previous cancellation request was declined. Contact support or submit updated details if needed.'
          : 'This order is already confirmed/preparing. Submit a cancellation request for admin approval.',
      canDirectCancel: false,
      canRequestCancellation: true,
      canRequestReturn: false,
    };
  }

  if (orderStatus === 'shipped') {
    return {
      mode: 'shipped_blocked',
      message: 'Order has already been shipped and cannot be cancelled. Please use Return after delivery if eligible.',
      canDirectCancel: false,
      canRequestCancellation: false,
      canRequestReturn: false,
    };
  }

  if (orderStatus === 'delivered') {
    const returnAllowed = canCustomerRequestReturn(orderStatus, deliveredAt, now);
    return {
      mode: 'return_only',
      message: returnAllowed
        ? 'Order has been delivered. Direct cancellation is closed, but you can submit a 7-day return request.'
        : 'Order has been delivered and the 7-day return window has passed.',
      canDirectCancel: false,
      canRequestCancellation: false,
      canRequestReturn: returnAllowed,
    };
  }

  return {
    mode: 'none',
    message: 'Cancellation is not available for the current order status.',
    canDirectCancel: false,
    canRequestCancellation: false,
    canRequestReturn: false,
  };
}

export function canCustomerRequestReturn(status: OrderStatus, deliveredAt?: Date | string | null, now: Date = new Date()): boolean {
  if (status !== 'delivered') return false;
  if (!deliveredAt) return true;
  const elapsedMs = now.getTime() - new Date(deliveredAt).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return elapsedMs <= sevenDaysMs;
}

export function computeAvailableStock(stockOnHand: number, reservedStock = 0): number {
  const onHand = Number.isFinite(Number(stockOnHand)) ? Math.floor(Number(stockOnHand)) : 0;
  const reserved = Number.isFinite(Number(reservedStock)) ? Math.floor(Number(reservedStock)) : 0;
  return Math.max(0, onHand - reserved);
}

export function shouldRestoreStockOnCancel(
  previousStatus: OrderStatus,
  paymentStatus: PaymentStatus,
): boolean {
  // Stock was reserved when order was created unless payment already failed/cancelled before reservation or already shipped/returned
  if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
    return false;
  }
  return ['pending', 'confirmed', 'processing', 'packed'].includes(previousStatus);
}
