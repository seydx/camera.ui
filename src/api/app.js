/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const cors = require('cors');
const fs = require('fs-extra');
const helmet = require('helmet');
const history = require('connect-history-api-fallback');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const os = require('os');

const express = require('express');
const app = express();

//swagger
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = require('./docs/swagger');
const specs = swaggerJsdoc(swaggerOptions);

const AuthRouter = require('./components/auth/auth.routes');
const BackupRouter = require('./components/backup/backup.routes');
const CamerasRouter = require('./components/cameras/cameras.routes');
const ConfigRouter = require('./components/config/config.routes');
const FilesRouter = require('./components/files/files.routes');
const NotificationsRouter = require('./components/notifications/notifications.routes');
const RecordingsRouter = require('./components/recordings/recordings.routes');
const SettingsRouter = require('./components/settings/settings.routes');
const SubscribeRouter = require('./components/subscribe/subscribe.routes');
const SystemRouter = require('./components/system/system.routes');
const UsersRouter = require('./components/users/users.routes');

exports.App = (options) => {
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        // eslint-disable-next-line quotes
        defaultSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'"],
        // eslint-disable-next-line quotes
        scriptSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'https://*.googleapis.com', 'blob:'],
        // eslint-disable-next-line quotes
        connectSrc: ['ws:', 'wss:', 'https:', 'https://api.npms.io/*', "'unsafe-eval'", "'unsafe-inline'", "'self'"],
        // eslint-disable-next-line quotes
        'img-src': ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'data:', 'blob:'],
        // eslint-disable-next-line quotes
        'media-src': ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'data:', 'blob:'],
      },
    })
  );
  app.use(morgan('dev', { skip: () => !options.debug }));

  const backupUpload = multer({
    storage: multer.diskStorage({
      destination: async (request, file, callback) => {
        const backupDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'cameraui-restore-'));
        callback(null, backupDirectory);
      },
      filename: (request, file, callback) => {
        callback(null, file.originalname);
      },
    }),
  });

  AuthRouter.routesConfig(app);
  BackupRouter.routesConfig(app, backupUpload);
  CamerasRouter.routesConfig(app);
  ConfigRouter.routesConfig(app);
  FilesRouter.routesConfig(app);
  NotificationsRouter.routesConfig(app);
  RecordingsRouter.routesConfig(app);
  SettingsRouter.routesConfig(app);
  SubscribeRouter.routesConfig(app);
  SystemRouter.routesConfig(app);
  UsersRouter.routesConfig(app);

  app.get('/version', (req, res) => {
    res.status(200).send({
      version: options.version,
    });
  });

  app.use(
    '/swagger',
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      swaggerOptions: {
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: false,
        showExtensions: true,
        showCommonExtensions: true,
        displayOperationId: false,
      },
    })
  );

  app.use(history({ index: 'index.html', verbose: options.debug }));
  app.use(express.static(path.join(__dirname, '../../interface')));

  return app;
};
