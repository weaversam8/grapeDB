#!/bin/bash

# startup file for this docker image

# start the mongodb daemon
service mongod start

# run only the first time the container starts
if [ -e /usr/app/volume/firststartup.tmp ];
then
  echo "first startup"
  mongoimport --db graphql --collection Type --file /usr/app/types.json
  mongoimport --db graphql --collection Interface --file /usr/app/interfaces.json
  rm /usr/app/volume/firststartup.tmp
else
  echo "not first startup"
fi

# create the appropriate database if it doesn't already exist
echo "use graphql\nexit" | mongo

# keep the server running
cd /usr/app/grapedb
npm run start
