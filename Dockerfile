# The site is plain static files (libraries load from a CDN via the import map in
# index.html), so there is no build step: nginx serves the files as they are.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Cloud Run sets PORT; the image renders the template below with it at start-up.
ENV PORT=8080 NGINX_ENVSUBST_FILTER=^PORT$
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

COPY index.html /usr/share/nginx/html/index.html
COPY src /usr/share/nginx/html/src
COPY assets /usr/share/nginx/html/assets
