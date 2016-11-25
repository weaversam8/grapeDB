#!/bin/bash

# startup file for this docker image

# start the mongodb daemon
service mongod start

# create the appropriate database if it doesn't already exist
echo "use graphql\nexit" | mongo

# keep the server running
cd /usr/app/grapedb
npm run start
