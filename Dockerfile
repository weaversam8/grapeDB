# grapeDB
# a database that runs mongo under the hood but is designed to be entirely graphql oriented

FROM ubuntu:14.04
MAINTAINER Sam Weaver <sam@samweaver.com>

# setup to run under bash instead of sh
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# from https://docs.docker.com/engine/examples/mongodb/
# Import MongoDB public GPG key AND create a MongoDB list file
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
RUN echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-3.2.list

# install all needed packages
RUN apt-get update && \
    apt-get install -y \
      mongodb-org=3.2.11 \
      build-essential \
      curl \
      vim

# install node
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 4.6.2

# Install nvm with node and npm
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.0/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# Set up our PATH correctly so we don't have to long-reference npm, node, &c.
ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# create mongodb data directory and expose it as a volume
RUN mkdir -p /data/db
VOLUME /data/db

# setup the missing service
ADD mongod.init.d /etc/init.d/mongod

# now, add the application specific items
ADD startup.sh /usr/app/startup.sh
RUN chmod 775 /usr/app/startup.sh
ADD grapedb/ /usr/app/grapedb

# install the node application
WORKDIR /usr/app/grapedb/
RUN npm i --production

# TODO expose ports
EXPOSE 3000

# run the application
ENTRYPOINT ["/bin/bash","/usr/app/startup.sh"]
