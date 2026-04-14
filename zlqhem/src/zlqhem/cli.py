"""CLI entry point for zlqhem."""

import argparse
import sys

from zlqhem.classify import classify_text
from zlqhem.scorer import score


def _run_debug(text: str):
    """Print detailed scoring info for each word."""
    for word in text.split(" "):
        if not word:
            continue
        result, confidence, lang = score(word)
        tag = {"en": "EN", "kr": "KR", "pass": "--"}[lang]
        print(f"  {word:<16} → {result:<12} [{tag}] conf={confidence:.1f}")


def main():
    parser = argparse.ArgumentParser(
        prog="zlqhem",
        description="Terminal bilingual input (키보드)",
    )
    sub = parser.add_subparsers(dest="command")

    # daemon subcommand
    sub.add_parser("daemon", help="Start background daemon")

    # convert subcommand (inline)
    convert_p = sub.add_parser("convert", help="Convert text")
    convert_p.add_argument("text", nargs="?", help="Text to convert")
    convert_p.add_argument("-d", "--debug", action="store_true", help="Show scoring details")

    args = parser.parse_args()

    if args.command == "daemon":
        from zlqhem.daemon import start
        start()
    elif args.command == "convert":
        text = args.text
        if text is None:
            text = sys.stdin.read().strip()
        if args.debug:
            _run_debug(text)
        else:
            print(classify_text(text))
    else:
        # Default: read from stdin if piped, else show help
        if not sys.stdin.isatty():
            for line in sys.stdin:
                print(classify_text(line.rstrip("\n")))
        else:
            parser.print_help()
