import google.generativeai as genai

def prompt_ai(**kwargs) -> str:
    source_code = kwargs.get("source_code", "")
    filename = kwargs.get("filename", "")
    prompt = kwargs.get("prompt", "")
    model_name = kwargs.get("model_name", "gemini-2.0-flash")
    temperature = kwargs.get("temperature", 0.7)

    if not prompt:
        prompt = (
            f"Please review this file '{filename}' for bugs, improvements, and readability issues:\n\n"
            f"{source_code}"
        )

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt, generation_config={"temperature": temperature})
        return response.text.strip()
    except Exception as e:
        print("Error:", e)
        return f"Error calling Gemini API: {e}"