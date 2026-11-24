FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir \
    --retries 10 \
    --timeout 120 \
    --index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    -r requirements.txt

COPY app/ ./app/
COPY alembic.ini .
COPY alembic/ ./alembic/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]