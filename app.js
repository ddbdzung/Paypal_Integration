require('dotenv').config()
const express = require('express')
const Plan = require('./models/Plan')
const { connectDb } = require('./mongoose')
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
    console.log(plans)
    res.render('pages/plans', {
        plans,
        // clientId: process.env.CLIENT_ID,
    })
})

app.post('/api/v1/plans', async (req, res) => {
    const plan = req.body
    const newPlan = await Plan.create(plan)
    res.status(201).json(newPlan)
})

app.get('/subscription/checkout', async (req, res) => {
    const planIds = (await Plan.find({}, 'paypalPlanId')).map(plan => plan.paypalPlanId)
    const {planId} = req.query
    if (!planIds.includes(planId)) {
        return res.status(404).send('Plan not found')
    }

    res.render('pages/checkout', {
        planId,
        clientId: process.env.CLIENT_ID,
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
