"""Tests for config/environment.py's .env loading behavior."""

import os

from blogresearch.config import environment as env


def test_load_environment_reads_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("SOME_TEST_VAR=from-dotenv\n", encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SOME_TEST_VAR", raising=False)

    env.load()

    assert os.environ["SOME_TEST_VAR"] == "from-dotenv"


def test_load_environment_does_not_override_real_env_vars(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("SOME_TEST_VAR=from-dotenv\n", encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("SOME_TEST_VAR", "from-real-environment")

    env.load()

    assert os.environ["SOME_TEST_VAR"] == "from-real-environment"
