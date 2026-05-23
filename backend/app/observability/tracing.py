import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from fastapi import FastAPI

tracer = trace.get_tracer("storesense-backend")

def setup_tracing(app: FastAPI):
    # Retrieve endpoint from environment or fallback to collector service name
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector-service:4317")
    
    resource = Resource.create(attributes={
        "service.name": "storesense-backend",
        "environment": os.getenv("APP_ENV", "production")
    })
    
    provider = TracerProvider(resource=resource)
    
    # Export spans using gRPC to Otel Collector
    processor = BatchSpanProcessor(
        OTLPSpanExporter(
            endpoint=endpoint,
            insecure=True
        )
    )
    
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    
    # Instrument the FastAPI app instance
    FastAPIInstrumentor.instrument_app(app)
