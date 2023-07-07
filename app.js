require('dotenv').config()
const express = require('express')
const { PAYPAL_CURRENCY, PAYPAL_TENURE_TYPE, PAYPAL_STATUS, PAYPAL_INTERVAL_UNIT } = require('./constants/paypal')
const { validate } = require('./middlewares/validate')
const Plan = require('./models/Plan')
const { planValidation } = require('./validations')
const { connectDb } = require('./mongoose')
const { pick } = require('./utils/pick')
const { createPlan } = require('./modules/paypal')
const app = express()
const port = 3000

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
        title: "Home Page"
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
        const planDocument = await Plan.create(rawPlan)
        const paypalPlan = await createPlan(planDocument)
        planDocument.paypalPlanId = paypalPlan.id
        if (!paypalPlan) {
            console.error('Something went wrong with syncing plan to paypal')

            return res.status(500).json({
                success: false,
                message: 'Something went wrong'
            })
        }

        await planDocument.save()

        res.status(201).json({
            success: true,
            data: paypalPlan,
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            success: false,
            message: 'Something went wrong'
        })
    }


})

app.post('/api/v1/plans', async (req, res) => {
    const plan = req.body
    const newPlan = await Plan.create(plan)
    res.status(201).json(newPlan)
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

app.get('/about', (req, res) => {
    res.render('pages/about', {
        title: "About"
    })
})

app.listen(port, () => {
  console.log(`App listening at port ${port}`)
})
