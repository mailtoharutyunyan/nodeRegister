const express = require('express');
const authRoute = require("./routes/AuthRoute");

const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const morgan = require("morgan");

const keys = require('./config/keys');
const app = express();


mongoose.connect(keys.mongoURI, {useCreateIndex: true, useNewUrlParser: true})
    .then(() => console.log('MongoDB connected.'))
    .catch(error => console.log(error));

app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.use(morgan("dev"));

app.use('/', authRoute);


app.get('/',(req,res)=>{
   res.status(200).json({
       message:"Hi Bros"
   })
});


app.listen(3002,()=>console.log('express started'));