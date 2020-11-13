/* eslint-disable no-console */
require('dotenv').config();
const express = require('express');
const digitalocean = require('digitalocean');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 8888;

const client = digitalocean.client(process.env.DO_TOKEN);

const containers = {
  raster: {
    container: 'axismaps/spatial-studies-raster-processor',
  },
  image: {
    container: 'axismaps/spatial-studies-image-processor',
  },
  tiles: {
    container: 'axismaps/tile-generator',
    tags: true,
  },
};

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/:task', (req, res) => {
  const { task } = req.params;
  const { container, tags } = containers[task];
  if (container) {
    const { awsKey, awsSecret, bucketSource, bucketTarget, project } = req.body;
    if (awsKey && awsSecret && bucketTarget && project) {
      let image = container;
      if (tags) image += `:${project}`;
      let env = `-e AWS_ACCESS_KEY_ID=${awsKey} -e AWS_SECRET_ACCESS_KEY=${awsSecret} -e BUCKET_TARGET=${bucketTarget}`;
      if (task === 'raster' || task === 'image') env += ` -e BUCKET_SOURCE=${bucketSource}`;
      const data = `#!/bin/bash\n
        curl -sSL https://agent.digitalocean.com/install.sh | sh\n
        docker pull ${image}\n
        docker run ${env} ${image}\n
        shutdown -P`;

      client.droplets.create(
        {
          name: `${project}-${task}`,
          region: 'nyc2',
          image: 'docker-18-04',
          size: 's-8vcpu-32gb',
          user_data: data,
        },
        () => {
          res.status(200);
        }
      );
    }
  }
  return res.status(500);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
