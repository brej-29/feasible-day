.PHONY: install run test clean

VENV_DIR := venv

$(VENV_DIR)/bin/activate:
	python3 -m venv $(VENV_DIR)

install: $(VENV_DIR)/bin/activate
	. $(VENV_DIR)/bin/activate && pip install --upgrade pip && pip install -r requirements.txt

run:
	. $(VENV_DIR)/bin/activate && streamlit run app.py

test:
	. $(VENV_DIR)/bin/activate && python -m compileall .

clean:
	rm -rf $(VENV_DIR) __pycache__ .pytest_cache logs
	find . -name "*.pyc" -delete