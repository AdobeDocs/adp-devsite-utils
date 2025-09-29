export default {
  pathPrefix: '/docs',
  siteMetadata: {
    title: 'Documentation',
    description: 'Documentation site',
    home: {
      title: 'Home',
      path: '/',
      hidden: false
    },
    versions: [
      {
        title: 'v1.0',
        path: '/v1.0',
        selected: true
      },
      {
        title: 'v2.0',
        path: '/v2.0',
        selected: false
      }
    ],
    pages: [
      {
        title: 'Getting Started',
        path: '/getting-started'
      },
      {
        title: 'API Reference',
        menu: [
          {
            title: 'Authentication',
            path: '/api/auth'
          },
          {
            title: 'Endpoints',
            path: '/api/endpoints'
          }
        ]
      }
    ],
    subPages: {
      'getting-started': {
        title: 'Getting Started',
        path: '/getting-started',
        header: true,
        pages: {
          'installation': {
            title: 'Installation',
            path: '/getting-started/installation'
          },
          'quick-start': {
            title: 'Quick Start',
            path: '/getting-started/quick-start'
          }
        }
      },
      'api': {
        title: 'API Reference',
        path: '/api',
        header: true,
        pages: {
          'auth': {
            title: 'Authentication',
            path: '/api/auth'
          },
          'endpoints': {
            title: 'Endpoints',
            path: '/api/endpoints'
          }
        }
      }
    },
    siteWideBanner: {
      message: 'This is a sample banner',
      type: 'info',
      dismissible: true
    }
  }
}; 