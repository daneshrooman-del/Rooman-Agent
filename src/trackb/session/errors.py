class SessionCapacityError(Exception):
    """Raised when a session is rejected because `max_concurrent_sessions` is already in use
    and no slot freed up within the guard's acquire-timeout budget.

    This is the fail-fast counterpart to unbounded queuing -- exactly the capacity-driven
    overload mode that produced the Tavus/HeyGen incidents this guard exists to avoid.
    """


class SessionJoinTimeoutError(Exception):
    """Raised when a room-join does not complete within `session_init_timeout_seconds`.

    The slot is released when this fires, so one hung join can never permanently starve
    the pool -- this is the other Tavus/HeyGen incident mode (10-60s+ init latency spikes).
    """
