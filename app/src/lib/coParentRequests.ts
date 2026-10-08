/** A response belongs to both an authorization lifetime and a read order.
 * Revocation, changing family and leaving invalidate the whole lifetime;
 * a newer read supersedes only older reads, not an in-flight mutation. */
export interface CoParentRequestTicket { epoch: number; sequence: number }
export class CoParentRequests {
  private epoch = 0;
  private sequence = 0;
  begin(): CoParentRequestTicket { return { epoch: this.epoch, sequence: ++this.sequence }; }
  belongs(ticket: CoParentRequestTicket): boolean { return ticket.epoch === this.epoch; }
  latest(ticket: CoParentRequestTicket): boolean { return this.belongs(ticket) && ticket.sequence === this.sequence; }
  invalidate(): void { this.epoch += 1; this.sequence = 0; }
}
