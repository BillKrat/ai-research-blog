"""Streamlit entrypoint - the only module that talks to Streamlit directly."""

import streamlit as st

from blogresearch.config import environment as env
from blogresearch.config.registrations import resolve_presenter
from blogresearch.views.streamlit_view import StreamlitView

env.load()

view = StreamlitView(st.session_state)
presenter = resolve_presenter(view)

st.title("BlogResearch — MVPVM + DI + Provider Model")

if st.button("Ask"):
    presenter.on_button_click()

if view.view_model.error:
    st.error(view.view_model.error)
else:
    st.write("Result:", view.view_model.result)
