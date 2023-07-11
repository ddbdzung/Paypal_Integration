require('dotenv').config()
const express = require('express')
const { PAYPAL_CURRENCY, PAYPAL_TENURE_TYPE, PAYPAL_STATUS, PAYPAL_INTERVAL_UNIT, PAYPAL_EVENT_SUBSCRIPTION, PAYPAL_EVENT_PLAN } = require('./constants/paypal')
const { validate } = require('./middlewares/validate')
const Plan = require('./models/Plan')
const { planValidation } = require('./validations')
const { connectDb } = require('./mongoose')
const { pick } = require('./utils/pick')
const { createPlan } = require('./modules/paypal')
const uuid = require('uuid');
const { default: axios } = require('axios')

const fs = require('fs')
const https = require('https')

const certCrt = fs.readFileSync('./config/cert.crt')
const certKey = fs.readFileSync('./config/cert.key')

const app = express()
const port = 3000
const httpsPort = 3001

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const posts = [
    {title: 'Title 1', body: 'Body 1' },
    {title: 'Title 2', body: 'Body 2' },
    {title: 'Title 3', body: 'Body 3' },
    {title: 'Title 4', body: 'Body 4' },
]
connectDb()
const user = {
    firstName: 'Tim',
    lastName: 'Cook',
}

app.get('/', (req, res) => {
    res.render('pages/index', {
        user,
        title: "Home Page1"
    })
})

app.get('/articles', (req, res) => {
    res.render('pages/articles', {
        articles: posts,
        title: "Articles"
    })
})

app.get('/subscription/plans', async (req, res) => {
    const plans = await Plan.find({})
    res.render('pages/plans', {
        plans,
    })
})

app.post('/api/v1/paypal/webhook/plan-created', async (req, res) => {
    console.log(req.body)
    res.status(200).send('OK')
})

app.get('/api/v1/paypal/webhook/list-events', async (req, res) => {
    const url = 'https://api-m.sandbox.paypal.com/v1/notifications/webhooks'
    const configs = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET,
        },
    }
    try {
        const { data } = await axios({
            url,
            ...configs,
        })
        res.json(data)
    } catch (error) {
        res.status(500).json({ error })
    }
})

app.get('/api/v1/paypal/webhook/show-event/:eventId', async (req, res) => {
    const { eventId } = req.params
    const url = `https://api-m.sandbox.paypal.com/v1/notifications/webhooks/${eventId}`
    const configs = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET,
        },
    }
    try {
        const { data } = await axios({
            url,
            ...configs,
        })
        res.json(data)
    } catch (error) {
        res.status(500).json({ error })
    }
})

app.post('/api/v1/paypal/webhook/update-event/:eventId', async (req, res) => {
    const { eventId } = req.params
    const { urlListener, eventTypes } = req.body
    const url = `https://api-m.sandbox.paypal.com/v1/notifications/webhooks/${eventId}`
    const bodyData = [
        {
            op: 'replace',
            path: '/url',
            value: urlListener,
        },
        {
            op: 'replace',
            path: '/event_types',
            value: eventTypes,
        }
    ]
    console.log('🚀 ~ file: app.js:127 ~ app.post ~ bodyData:', bodyData)
    const configs = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET,
        },
    }
    try {
        const { data } = await axios({
            url,
            data: bodyData,
            ...configs,
        })

        return res.status(200).json(data)
    } catch (err) {
        return res.status(500).json({ error: err.response?.data })
    }
})

app.post('/api/v1/paypal/webhook/create-event', async (req, res) => {
    const { urlListener, eventTypes } = req.body
    const url = 'https://api-m.sandbox.paypal.com/v1/notifications/webhooks'
    const bodyData = {
        url: urlListener,
        event_types: eventTypes,
    }
    const configs = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET,
        },
    }
    try {
        const { data } = await axios({
            url,
            data: bodyData,
            ...configs,
        })
        res.json(data)
    } catch (error) {
        if (error.response.data?.name === 'WEBHOOK_URL_ALREADY_EXISTS') {
            return res.status(500).json({ error: error.response.data?.message })
        }

        res.status(500).json({ error })
    }
})

// const verifyWebhookSignature = (headers, body) => {
//     const { paypalTransmissionId, paypalTransmissionTime, paypalCertUrl, paypalAuthAlgo, paypalTransmissionSig } = headers
//     const cert = fs.readFileSync('./config/paypal-cert.pem')
//     const verifier = crypto.createVerify('sha256')
//     verifier.update(`${paypalTransmissionId}|${paypalTransmissionTime}|${body}`)
//     const isVerified = verifier.verify(cert, paypalTransmissionSig, 'base64')
//     return isVerified
// }

app.post('/api/v1/paypal/webhook/subscription', async (req, res) => {
    const { event_type, resource, summary } = req.body
    console.log(event_type, summary)

    switch (event_type) {
        case PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_CREATED:
            console.log(PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_CREATED, resource.plan_id)
            break;
        case PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED:
            console.log(PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED, resource.id)
            break;

        default:
            console.log('Event type not handled')
            console.log(PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED, null)
            break;
    }

    return res.status(201).json({
        success: true,
        // message: 'User subscribed successfully',
        // data: req.body,
    })
})

app.get('/subscription/plans/new', async (req, res) => {
    res.render('pages/create-plan', {
        currencies: PAYPAL_CURRENCY,
        status: PAYPAL_STATUS,
        tenureTypes: PAYPAL_TENURE_TYPE,
        durationUnits: PAYPAL_INTERVAL_UNIT,
    })
})

app.post('/api/v1/subscription/plans/new', validate(planValidation.createPlan), async (req, res) => {
    const rawPlan = pick(req.body, [
        'title',
        'description',
        'price',
        'currency',
        'status',
        'tenureType',
        'durationAmount',
        'durationUnit',
    ])
    try {
        const isPlanExists = await Plan.findOne({ title: rawPlan.title })
        if (isPlanExists) {
            return res.status(400).json({
                success: false,
                message: 'Plan already exists'
            })
        }

        const planDocument = new Plan(rawPlan)
        const paypalPlan = await createPlan(planDocument)
        if (!paypalPlan) {
            console.error('Something went wrong with syncing plan to paypal')

            return res.status(500).json({
                success: false,
                message: 'Something went wrong'
            })
        }

        planDocument.paypalPlanId = paypalPlan.id
        await planDocument.save()

        res.status(201).json({
            success: true,
            data: paypalPlan,
        })
    } catch (error) {
        console.error('Something went wrong with creating plan', error)

        res.status(500).json({
            success: false,
            message: 'Something went wrong'
        })
    }


})


app.get('/subscription/checkout', async (req, res) => {
    const planIds = (await Plan.find({}, 'paypalPlanId')).map(plan => plan.paypalPlanId)
    const { planId } = req.query
    if (!planIds.includes(planId)) {
        return res.status(404).send('Plan not found')
    }

    res.render('pages/checkout', {
        planId,
        clientId: process.env.PAYPAL_CLIENT_ID,
    })
})

app.get('/api/v1/subscription/capture/:subscriptionId', async (req, res) => {
    const { subscriptionId } = req.params
    console.log('me here', subscriptionId)
    // const { currency_code, value } = req.body
    const currency_code = 'USD'
    const value = '299'
    const paypalRequestId = () => uuid.v4()
    const url = `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}/capture`;
    const configs = {
        method: 'POST',
        headers: {
            'PayPal-Request-Id': paypalRequestId(),
            'Content-Type': 'application/json',
        },
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET,
        },
    }
    const data = {
        note: 'Charging the customer',
        capture_type: 'OUTSTANDING_BALANCE',
        amount: {
            currency_code,
            value,
        }
    }

    try {
        const response = await axios({
            url,
            data,
            ...configs
        })
        console.log(response.data)

        res.status(200).json(response.data)
    } catch (err) {
        console.log(err?.response?.data)
        res.status(500).json(err)
    }
})

app.get('/about', (req, res) => {
    res.render('pages/about', {
        title: "About"
    })
})

app.listen(port, () => {
  console.log(`App listening at port ${port}`)
})

https.createServer({
    key: certKey,
    cert: certCrt,
}, app).listen(httpsPort, () => {
    console.log(`App https listening at port ${httpsPort}`)
})
