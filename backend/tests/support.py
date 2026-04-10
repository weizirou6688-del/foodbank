from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AsyncBegin:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class ScalarResult:
    def __init__(self, rows):
        self._rows = [row for row in rows if row is not None]

    def unique(self):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def one_or_none(self):
        return self.first()


class ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def unique(self):
        return self

    def scalars(self):
        return ScalarResult(self._rows)

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalar_one(self):
        if len(self._rows) != 1:
            raise AssertionError(f"Expected exactly one row, got {len(self._rows)}")
        return self._rows[0]


class QueuedAsyncSession:
    def __init__(self):
        self.committed = False
        self.rolled_back = False
        self.execute_queue = []

    def add_execute_result(self, result_rows):
        self.execute_queue.append(result_rows)

    async def execute(self, _query):
        if self.execute_queue:
            return ExecuteResult(self.execute_queue.pop(0))
        return ExecuteResult([])

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True
