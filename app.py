import streamlit as st
from config.container import resolve_presenter
from data.tools_provider import ToolsProvider

if "result" not in st.session_state:
    st.session_state["result"] = ""

tools = ToolsProvider(
    use_dci=False,
    use_custom_presenter=False,
    use_postgres=False
)

presenter = resolve_presenter(tools, st.session_state)

st.title("BlogResearch — MVP + DI + Provider Model")

if st.button("Ask"):
    presenter.on_button_click()

st.write("Result:", st.session_state["result"])
