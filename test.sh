#!/usr/bin/env bash
DOCKER_CONTAINER_NAME=neo4j_testdb
EXPOSED_PORT="8080"
YARN_CMD=${1:-test}

if [ "$(docker ps -a -q -f name=$DOCKER_CONTAINER_NAME)" ]; then
      if [ "$(docker ps -aq -f status=exited -f name=$DOCKER_CONTAINER_NAME)" ]; then
            echo "stopped"
      else 
            echo "stopping"
            docker stop $DOCKER_CONTAINER_NAME
      fi
      docker rm $DOCKER_CONTAINER_NAME
fi

docker run -d \
    --name=$DOCKER_CONTAINER_NAME \
    --publish=7070:7474 --publish=$EXPOSED_PORT:7687 \
    --env NEO4J_ACCEPT_LICENSE_AGREEMENT=yes \
    --env NEO4J_AUTH=neo4j/local \
    --env NEO4J_apoc_export_file_enabled=true \
    --env NEO4J_apoc_import_file_enabled=true \
    --env NEO4J_apoc_import_file_use__neo4j__config=true \
    --env NEO4JLABS_PLUGINS=\[\"apoc\"\] \
    --env=NEO4J_dbms_memory_pagecache_size=2G \
    --env=NEO4J_dbms_memory_heap_max__size=4G \
    --health-cmd='wget http://localhost:7474 || exit 1' \
      neo4j:4.4.14-community

while [ "$(docker inspect -f '{{.State.Health.Status}}' $DOCKER_CONTAINER_NAME)" != "healthy" ]; do
      echo "Waiting for neo4j-docker container to become healthy"
      sleep 2
done

export NEO4J_DATABASE_USERNAME="neo4j"
export NEO4J_DATABASE_HOST="bolt://localhost:$EXPOSED_PORT"
export NEO4J_DATABASE_PASSWORD="local"
export NODE_ENV='development'
yarn "$YARN_CMD"

docker stop $DOCKER_CONTAINER_NAME
docker rm $DOCKER_CONTAINER_NAME
