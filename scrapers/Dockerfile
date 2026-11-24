FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN addgroup --system --gid 1001 scraper && \
    adduser --system --uid 1001 --ingroup scraper scraper

COPY scrapers/requirements.txt ./scrapers/requirements.txt
RUN pip install --no-cache-dir -r scrapers/requirements.txt

COPY --chown=scraper:scraper scrapers ./scrapers

USER scraper

CMD ["python", "-m", "unittest", "scrapers/tests/test_pipeline.py", "-v"]
