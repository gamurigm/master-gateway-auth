FROM openpolicyagent/opa:latest

COPY security/opa/authz.rego /policies/authz.rego

EXPOSE 8181

CMD ["run", "--server", "--addr=0.0.0.0:8181", "/policies"]
