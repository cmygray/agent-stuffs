"""Tests for the Unix socket daemon."""

import asyncio
import os
import pytest
import pytest_asyncio

from zlqhem.daemon import SOCK_PATH, run_daemon


@pytest_asyncio.fixture
async def daemon():
    """Start daemon in background, yield, then stop it."""
    task = asyncio.create_task(run_daemon())
    # Wait for socket to appear
    for _ in range(50):
        if os.path.exists(SOCK_PATH):
            break
        await asyncio.sleep(0.05)
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    # Cleanup
    for p in (SOCK_PATH, "/tmp/zlqhem.pid"):
        try:
            os.unlink(p)
        except FileNotFoundError:
            pass


async def _query(word: str) -> str:
    reader, writer = await asyncio.open_unix_connection(SOCK_PATH)
    writer.write(word.encode("utf-8"))
    writer.write_eof()
    data = await asyncio.wait_for(reader.read(), timeout=2.0)
    writer.close()
    await writer.wait_closed()
    return data.decode("utf-8")


@pytest.mark.asyncio
class TestDaemon:
    async def test_single_korean_word(self, daemon):
        result = await _query("gksrmf")
        assert result == "한글"

    async def test_single_english_word(self, daemon):
        result = await _query("project")
        assert result == "project"

    async def test_full_sentence(self, daemon):
        result = await _query("gksrmf project wjawlswjr")
        assert result == "한글 project 점진적"

    async def test_passthrough(self, daemon):
        result = await _query("123")
        assert result == "123"
