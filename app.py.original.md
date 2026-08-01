import os

import streamlit as st
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

st.title("AI Research Blog")
st.write("Minimal pipeline check: Streamlit → Claude API → response.")

if st.button("Say Hello"):
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=16,
        messages=[
            {
                "role": "user",
                "content": "Respond with exactly the text: Hello World",
            }
        ],
    )
    st.write(response.content[0].text)
