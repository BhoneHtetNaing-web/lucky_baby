export interface Booking {
    id: string;
    flightId: string;
    seats: string[];
    status: "pending" | "confirmed" | "cancelled";
    paymentSlip?: string;
}