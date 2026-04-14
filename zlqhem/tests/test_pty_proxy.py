"""Tests for pty proxy input handling logic."""

import os
from unittest.mock import patch

from zlqhem.pty_proxy import _handle_input, TOGGLE_KEY


class TestHandleInput:
    """Test the input handler without a real pty."""

    def setup_method(self):
        # Use a pipe as a mock fd for capturing output
        self.read_fd, self.write_fd = os.pipe()
        self.stdout_r, self.stdout_w = os.pipe()

    def teardown_method(self):
        for fd in (self.read_fd, self.write_fd, self.stdout_r, self.stdout_w):
            try:
                os.close(fd)
            except OSError:
                pass

    def _read_written(self) -> bytes:
        """Read what was written to the mock master fd."""
        import select
        result = b""
        while select.select([self.read_fd], [], [], 0)[0]:
            result += os.read(self.read_fd, 4096)
        return result

    def test_passthrough_when_inactive(self):
        active, buf = _handle_input(
            b"hello", self.write_fd, self.stdout_w, False, bytearray()
        )
        assert active is False
        written = self._read_written()
        assert written == b"hello"

    def test_toggle_on(self):
        active, buf = _handle_input(
            TOGGLE_KEY, self.write_fd, self.stdout_w, False, bytearray()
        )
        assert active is True

    def test_toggle_off(self):
        active, buf = _handle_input(
            TOGGLE_KEY, self.write_fd, self.stdout_w, True, bytearray()
        )
        assert active is False

    def test_buffer_word_when_active(self):
        active, buf = _handle_input(
            b"gks", self.write_fd, self.stdout_w, True, bytearray()
        )
        assert active is True
        assert buf == bytearray(b"gks")
        # Characters should be forwarded to master
        written = self._read_written()
        assert written == b"gks"

    def test_convert_on_space(self):
        # Pre-fill buffer with "gksrmf"
        buf = bytearray(b"gksrmf")
        active, buf = _handle_input(
            b" ", self.write_fd, self.stdout_w, True, buf
        )
        written = self._read_written()
        # Should contain backspaces + Korean + space
        assert b"\x7f" in written  # backspaces sent
        assert "한글".encode("utf-8") in written
        assert written.endswith(b" ")
        assert buf == bytearray()

    def test_english_word_no_conversion(self):
        buf = bytearray(b"project")
        active, buf = _handle_input(
            b" ", self.write_fd, self.stdout_w, True, buf
        )
        written = self._read_written()
        # "project" is English, no backspaces needed (word stays as-is)
        assert b"\x7f" not in written
        assert written == b" "

    def test_backspace_removes_from_buffer(self):
        buf = bytearray(b"gks")
        active, buf = _handle_input(
            b"\x7f", self.write_fd, self.stdout_w, True, buf
        )
        assert buf == bytearray(b"gk")
