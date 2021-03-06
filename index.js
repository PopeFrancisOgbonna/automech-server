const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express');
const PORT = process.env.PORT || 8080;
require('dotenv').config();
const {Client } = require('pg');
const app = express();
const sgMail = require('@sendgrid/mail');


app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors());
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
const client = new Client({

    connectionString: isProduction? process.env.DATABASE_URL: connectionString,
    ssl: isProduction? {
        rejectUnauthorized: false
    }:false
})
client.connect();
client.on("connect", (err, res) =>{
    if(err) return console.log(err);
    console.log('connected sucessfully!');
})
app.get("/", (req, res)=>{ 
    res.send('working...')
})

//Email Delivery service 
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

//Client Registration
app.post("/clients",(req, res)=>{
    const {fullName, password, phone, mail} = req.body;
    let query ="insert into clients (name, phone, email, password) values($1, $2, $3, #4)";
    client.query("insert into clients (name, phone, email, password) values($1, $2, $3, $4)",[fullName, phone, mail, password], (err, result) =>{
        if(err){
            throw err;
        }
        res.status(200).send("Registration Successful!");
    })
});
//Client login
app.post("/clients/login", (req, res) =>{
    const {userName, userPassword} = req.body;
    let query ="select * from clients where email = $1 and password = $2";
    client.query(query,[userName, userPassword],(err, result) =>{
        if(err){
            throw err;
        }
        if(!result.rows.length){
            return res.status(201).send('Invalid Email and Password');
        }
        res.status(200).send(result.rows);
    }) 
});

//Partners/Mechanics Registration
app.post("/partners",(req, res) =>{
    const {fullName, email, phone, businessName, serviceType, serviceSpec,address, place, password} = req.body;
    if((fullName ==="" || email ==="" || phone ==="" || businessName ==="" || serviceType ==="" || serviceSpec ==="" || address ==="" || place ==="" || password) === ""){
        return res.status(201).send("Invalid Inputs");
    }
    let query = 'insert into mechanics (name,phone, email, company,service_type, specialty, office_address, city, password) values($1,$2,$3,$4,$5,$6,$7,$8,$9)';
    client.query(query,[fullName,phone,email,businessName,serviceType,serviceSpec,address,place,password], (err, result) =>{
        if(err){
            throw err;
        }
        res.status(200).send("Account Created Successfully.");
    })
});
//Partners/Mechanics login
app.post("/partners/login", (req, res) =>{
    const {userName, userPassword} = req.body;
    let query = 'select * from mechanics where email = $1 and password = $2';
    client.query(query,[userName, userPassword], (err, result) =>{
        if(err){
            throw err;
        }
        if(!result.rows.length){
            return res.status(201).send('Invalid Email and Password');
        }
        res.status(200).send(result.rows);
    })
});
//Get Registered Mechanics
app.get("/mechanics", (req, res) =>{
    let query='select * from mechanics';
    client.query(query, (err, result) =>{
        if(err){
            throw err
        }
        if(result.rows.length){
            return res.status(200).send(result.rows);
        }
        res.status(201).send("Mechanics not Available.");
    })
});

//Service Request logging
app.post("/service/request", (req, res) =>{
    const {agent_name,agent_email,agent_phone,client_name,client_email,client_phone} = req.body;
   //Email body (Message to be delivered)
    const msg = {
        to: agent_email, // Change to your recipient
        from: {email:'francisogbonna24@gmail.com', name: 'Auto Mechanic Finder'}, // Change to your verified sender
        subject: 'Service Request from Client',
        text: 
        `Dear ${agent_name}, ${client_name} has requested for your services. Kindly reachout to him now.
        Client's Phone No: ${client_phone}  Client's Email: ${client_email}
        `,
    }
      
    if((agent_name ==="" || agent_email ==="" || agent_phone ==="" || client_name ==="" || client_email ==="" || client_phone ==="")){
        return res.status(201).send("Invalid Input.")
    }
    let query = 'insert into service_request (agent_name, agent_mail, agent_phone, clients, phone, email, status, remark) values($1,$2,$3,$4,$5,$6,$7,$8) returning id';
    client.query(query,[agent_name,agent_email,agent_phone,client_name,client_phone,client_email,"Pending",""], (err, result) =>{
        if(err){
            throw err;
        }
        sgMail
        .send(msg)
        .then(() => {
          console.log('Email sent')
        })
        .catch((error) => {
          console.error(error)
        })
        res.status(200).send(result.rows);
    })
   
});

app.get("/service/requests", (req, res) =>{
    let query ="select * from service_request";
    client.query(query, (err, result) =>{
        if(err){
            throw err;
        }
        res.status(200).send(result.rows);
    })
});

app.get("/service/requests/:id", (req, res) =>{
    let query ="select * from service_request where id =$1";
    client.query(query,[req.params.id], (err, result) =>{
        if(err){
            throw err;
        }
        res.status(200).send(result.rows);
    })
});

app.post("/service/requests/agent", (req, res) =>{
    const {email, phone} = req.body;
    let query ="select id, clients, phone, email, TO_CHAR(date, 'dd-MM-yyyy') as date, status, remark from service_request where agent_mail = $1 and agent_phone =$2";
    client.query(query, [email, phone], (err, result) =>{
        if(err){
            throw err;
        }
        res.status(200).send(result.rows);
    })
});

app.put("/service/requests/accept/:id", (req, res) =>{
    let query = "update service_request set status ='Accepted', remark = 'In Progress' where id =$1";
    client.query(query,[req.params.id], (err, result) =>{
        if(err){
            throw err;
        }
        // console.log(id);
        res.status(200).send(JSON.stringify(result.rowCount));
    })
});

app.put("/service/requests/reject/:id", (req, res) =>{
    let query = "update service_request set status ='Canceled', remark = 'Rejected' where id =$1";
    client.query(query,[req.params.id], (err, result) =>{
        if(err){
            throw err;
        }
        // console.log(id);
        res.status(200).send(JSON.stringify(result.rowCount));
    })
});

app.put("/service/requests/done/:id", (req, res) =>{
    let query = "update service_request set remark = 'Delivered' where id =$1";
    client.query(query,[req.params.id], (err, result) =>{
        if(err){
            throw err;
        }
        // console.log(id);
        res.status(200).send(JSON.stringify(result.rowCount));
    })
});

app.listen(PORT, () =>{console.log(`Server started at ${PORT}`)});


