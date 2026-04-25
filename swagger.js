import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EcoTrace API Documentation',
            description: "API endpoints for a EcoTrace services documented on swagger",
            contact: {
                name: "Desmond Obisi",
                email: "info@miniblog.com",
                url: "https://github.com/DesmondSanctity/node-js-swagger"
            },
            version: '1.0.0',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },

        security: [
            {
                bearerAuth: [],
            },
        ],
        servers: [
            {
                url: "http://localhost:5000/",
                description: "Local server"
            },
            {
                url: "https://ecotracebackend-pjo2.onrender.com/",
                description: "Live server"
            },
        ]
    },
    // looks for configuration in specified directories
    //apis: ['./src/routes/**/*.js'],
    apis: ["./**/*.js"],
}
const swaggerSpec = swaggerJsdoc(options)
function swaggerDocs(app, port) {
    // Swagger Page
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
    // Documentation in JSON format
    app.get('/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.send(swaggerSpec)
    })
}
export default swaggerDocs