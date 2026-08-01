"""Streamlit entrypoint - the only module that talks to Streamlit directly."""

import streamlit as st

from config.app_settings import AppSettings
from config.container import resolve_presenter
from config.environment import load_environment
from views.streamlit_view import StreamlitView

load_environment()

settings = AppSettings()
view = StreamlitView(st.session_state)
presenter = resolve_presenter(settings, view)

st.title("BlogResearch — MVP + DI + Provider Model")

if st.button("Ask"):
    presenter.on_button_click()

if view.error:
    st.error(view.error)
else:
    st.write("Result:", view.result)
