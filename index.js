import express from "express";
import bodyParser from 'body-parser';
import pg from "pg";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.urlencoded({ extended: true }));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static("public"));

var doctor_id;
var date;
var patient_name;
var time;
var phone_no;
var gender;
var age;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "hospital",
    password: "bharath@671",
    port: 5432,
});
db.connect();

const today = new Date();

async function getDoctors() {
    const result = await db.query("SELECT id,name,speciality FROM doctor");
    return result.rows;
};

function generateWeeks() {
    const weeks = [];
    const currentDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start from the first day of the current month
    const startDayOfWeek = currentDate.getDay(); // Get the day of the week for the first day of the month
    currentDate.setDate(currentDate.getDate() - startDayOfWeek); // Adjust the start date to the beginning of the week
    while (currentDate.getMonth() <= today.getMonth()) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        weeks.push(week);
    }
    return weeks;
}

function getMonthName(month) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[month];
}

app.get("/", async (req, res) => {
    res.render("home.ejs");
});

app.get("/admin-login",(req,res)=>{
    res.render("admin_login.ejs");
});

app.post("/admin-login-auth", async (req, res) => { 
    const password = req.body["password"];
    const email = req.body["email"];
    const result=await db.query("SELECT password from admin_data where email_id=($1)",
    [email]);
    if (result.rows.length==0) {
      res.render("admin_login.ejs",{message:"Email does not exist."});
    }
    else if (result.rows[0].password==password) {
       res.render("admin_page.ejs");
    }
    else res.render("admin_login.ejs",{message:"Password is incorrect"});
  });

app.post("/admin-action",async(req,res)=>{
   if(req.body["action"]=="editDoctor")  {
      const result=await db.query("SELECT * from doctor");
      res.render("edit_doctor_info.ejs",{doctors:result.rows}); 
   }

   if (req.body["action"]=="addDoctor") {
      res.render("add_doctor.ejs");
   }
 
   if (req.body["action"]=="deleteDoctor") {
      const result=await db.query("select name,speciality,id from doctor");
      res.render("delete_doctor.ejs",{doctors:result.rows});
   }

   if (req.body["action"]=="dischargeAdmittedPatients") {
        const result=await db.query("select * from patient_admitted");
        const patient=result.rows;
        res.render("dischargePatient.ejs",{patients:patient});
   }

   if (req.body["action"]=="billPayment") {
    const result=await db.query("select * from patient_admitted");
    const patient=result.rows;
      res.render("bill_Payment.ejs",{patients:patient});
   }
        
  if (req.body["action"]=="addPatient") {
    res.render("addPatient.ejs");
  }

  if (req.body["action"]=="viewDocotorInfo") {
    const result=await db.query("select name,speciality,id from doctor");
     res.render("viewDoctorInfo.ejs",{doctors:result.rows});
  }

  if (req.body["action"]=="viewPatientInfo"){
     const result=await db.query("select * from patient_admitted");
     const patient=result.rows;
     res.render("viewPatientInfo.ejs",{patients:patient});
  }
 
  if (req.body["action"]=="updateBill") {
     res.render("updateBill.ejs"); 
  }
  

});

app.get("/payment/:id",async(req,res)=>{
     const pat_id = req.params.id;
     const  result1=await db.query("select amount from bill where patient_id=($1)",
     [pat_id]);   
     const amount=result1.rows[0].amount;
     if (amount==0) {
         res.render("payment_page.ejs",{message1:"No dues are left"});
     }
     else {
        res.render("payment_page.ejs",{message2:amount,pat_id:pat_id});
     }
});

app.post("/make-payment", async (req, res) => {
    try {
        const pat_id = req.body["patId"];
        const result = await db.query("select amount from bill where patient_id=($1)", [pat_id]);
        var amount = result.rows[0].amount;
        amount = amount - parseFloat(req.body["paymentAmount"]);
        await db.query("update bill set amount=($1) where patient_id=($2)", [amount, pat_id]);
        
        // Redirect to a different route for displaying the success message
        res.redirect(`/payment-success?msg=${encodeURIComponent("Payment was successfully completed!")}`);
    } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).send("<div style='font-size: 20px;'>An error occurred while processing the payment.</div>");
    }
});

// Display success message
app.get("/payment-success", (req, res) => {
    const msg = req.query.msg || "Payment was successfully completed!";
    res.render("add_patient_msg.ejs", { msg });
});


app.post("/update-bill", async (req, res) => {
    try {
        const phoneNo = req.body["phone"];
        const patientName = req.body["name"];
        const pat = patientName.split(" ");
        let patName = "";
        pat.forEach(obj => {
            obj = obj.toLowerCase();
            let a = obj[0].toUpperCase();
            const temp = a + obj.slice(1, obj.length);
            patName = patName + temp + " ";
        });
        patName = patName.slice(0, patName.length - 1);
        const result = await db.query("select * from patient_admitted where phone_number=($1) ", [phoneNo]);
        if (result.rows.length == 0) {
            res.render("updateBill.ejs", { message: "The entered phone number is incorrect" });
        } else {
            if (result.rows[0].name != patName) {
                res.render("updateBill.ejs", { message: "The entered name is incorrect" });
            } else {
                var pat_id = result.rows[0].id;
                const result1 = await db.query("SELECT amount FROM bill WHERE patient_id = $1", [pat_id]);
                if (result1.rows.length === 0) {
                    throw new Error("No bill found for the patient");
                }
                var amount = result1.rows[0].amount;
                amount += parseFloat(req.body["paymentAmount"]); // Ensure req.body["paymentAmount"] is parsed as a number
                await db.query("UPDATE bill SET amount = $1 WHERE patient_id = $2", [amount, pat_id]);

                // Redirect to a different route for displaying the success message
                res.redirect(`/bill-update-success?msg=${encodeURIComponent("Bill was updated successfully!")}`);
            }
        }
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("An error occurred while incrementing the bill amount.");
    }
});

// Display success message
app.get("/bill-update-success", (req, res) => {
    const msg = req.query.msg || "Bill was updated successfully!";
    res.render("add_patient_msg.ejs", { msg });
});


app.get("/discharge/:id", async (req, res) => {
    try {
        const pat_id = req.params.id;
        const result1 = await db.query("SELECT amount FROM bill WHERE patient_id = $1", [pat_id]);

        // Check if result1.rows is not empty before accessing its elements
        if (result1.rows.length > 0) {
            const amount = result1.rows[0].amount;
            if (amount == 0) {
                await db.query("DELETE FROM patient_admitted WHERE id = $1", [pat_id]);
                await db.query("DELETE FROM bill WHERE patient_id = $1", [pat_id]);

                // Redirect to a different route for displaying the success message
                res.redirect(`/discharge-success?id=${pat_id}&msg=${encodeURIComponent("Patient was Discharged!")}`);
            } else {
                // Redirect to a different route for displaying the failure message
                res.redirect(`/discharge-failure?id=${pat_id}&msg=${encodeURIComponent("Patient Bills were not cleared, so patient cannot be discharged.")}`);
            }
        } else {
            // Redirect to a different route for displaying the failure message
            res.redirect(`/discharge-failure?id=${pat_id}&msg=${encodeURIComponent("No records found for the provided patient ID.")}`);
        }
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("An error occurred while processing the discharge.");
    }
});

// Display success message
app.get("/discharge-success", (req, res) => {
    const msg = req.query.msg || "Patient was Discharged!";
    res.render("discharge_msg.ejs", { msg1: msg });
});

// Display failure message
app.get("/discharge-failure", (req, res) => {
    const msg = req.query.msg || "Patient Bills were not cleared, so patient cannot be discharged.";
    res.render("discharge_msg.ejs", { msg2: msg });
});



app.get('/admin/edit-doctor/:id', async(req, res) => {
    const doctorId = req.params.id;
    const result=await db.query("SELECT * from doctor where id=($1)",
     [doctorId]);
     //console.log(result.rows);
    res.render("edit_doctor.ejs",{doctor:result.rows[0]});
});


app.post('/admin/edit-doctor-info/:id',async(req,res)=>{
   var newPhone_no=req.body["newPhone"];
   var newEmail=req.body["newEmail"];
   var newYearsOfExp=req.body["new_Years_Of_Experience"];
   var newSalary=req.body["newSalary"];
   var doctorId=req.params.id;
   const result=await db.query("SELECT * from doctor where id=($1)",
   [doctorId]);
   const info=result.rows[0];
   if (newPhone_no==""){
    newPhone_no=info.phone_number;
   }
   if (newEmail==""){
    newEmail=info.email;
   }
   if (newYearsOfExp==""){
     newYearsOfExp=info.years_of_experience;
   }
   if (newSalary==""){
     newSalary=info.salary;
   }
   await db.query("update doctor set (phone_number,email,years_of_experience,salary)=($1,$2,$3,$4) where id=($5)",
   [newPhone_no,newEmail,newYearsOfExp,newSalary,doctorId]);
  
   const updatedResult = await db.query("SELECT * FROM doctor WHERE id = $1", [doctorId]);
   const updatedInfo = updatedResult.rows[0];
    
   var doctor_name = updatedInfo.name;
   var doctor_speciality = updatedInfo.speciality;
   var doctor_phoneNo = updatedInfo.phone_number;
   var doctor_email = updatedInfo.email;
   var doctor_years_of_exp = updatedInfo.years_of_experience;
   var doctor_salary = updatedInfo.salary; 
   
   res.render("add_doctor_msg.ejs",{name:doctor_name,speciality:doctor_speciality,
    number:doctor_phoneNo,email:doctor_email,exp:doctor_years_of_exp,salary:doctor_salary,msg1:"Doctor details were successfully modified!"});
});

app.get('/view-doctor-info/:id',async(req,res)=>{
    var doctorId=req.params.id;
    const result = await db.query("SELECT * FROM doctor WHERE id = $1", [doctorId]);
    const info = result.rows[0];
    var doctor_name = info.name;
    var doctor_speciality = info.speciality;
    var doctor_phoneNo = info.phone_number;
    var doctor_email = info.email;
    var doctor_years_of_exp = info.years_of_experience;
    var doctor_salary = info.salary; 
   // Send the response
   res.render("add_doctor_msg.ejs",{name:doctor_name,speciality:doctor_speciality,
    number:doctor_phoneNo,email:doctor_email,exp:doctor_years_of_exp,salary:doctor_salary});

});

app.get("/view-patient-info/:id", async (req, res) => {
    const pat_id = req.params.id;
    const result1 = await db.query("SELECT * FROM patient_admitted WHERE id = $1", [pat_id]);
    const info = result1.rows[0];

    const result2 = await db.query("SELECT amount FROM bill WHERE patient_id = $1", [pat_id]);
    const info1 = result2.rows[0];

    // Convert join_date to only date string
    const joinDate = new Date(info.join_date);
    const formattedDate = `${joinDate.getFullYear()}-${(joinDate.getMonth() + 1).toString().padStart(2, '0')}-${joinDate.getDate().toString().padStart(2, '0')}`;

    res.render("patient_info_msg.ejs", { 
        name: info.name,  
        age: info.age, 
        gender: info.gender, 
        number: info.phone_number,
        date: formattedDate, // Use the manually formatted date
        time: info.join_time,  
        amount: info1.amount 
    });
});


app.post("/admin/add-doctor", async (req, res) => {
    try {
        var doctor_name = req.body["name"];
        var doctor_speciality = req.body["specialty"];
        var doctor_phoneNo = req.body["phone"];
        var doctor_email = req.body["email"];
        var doctor_years_of_exp = req.body["yearsOfExp"];
        var doctor_salary = req.body["salary"];

        await db.query("insert into doctor (name, speciality, email, phone_number, years_of_experience, salary) values ($1, $2, $3, $4, $5, $6)",
            [doctor_name, doctor_speciality, doctor_email, doctor_phoneNo, doctor_years_of_exp, doctor_salary]);

        // Redirect to a different route for displaying the success message
        res.redirect(`/admin/add-doctor-success?name=${encodeURIComponent(doctor_name)}&specialty=${encodeURIComponent(doctor_speciality)}&phone=${encodeURIComponent(doctor_phoneNo)}&email=${encodeURIComponent(doctor_email)}&yearsOfExp=${encodeURIComponent(doctor_years_of_exp)}&salary=${encodeURIComponent(doctor_salary)}&msg=${encodeURIComponent("Doctor added successfully!")}`);
    } catch (error) {
        console.error("Error adding doctor:", error);
        res.status(500).send("<div style='font-size: 20px;'>An error occurred while adding the doctor.</div>");
    }
});

// Display success message
app.get("/admin/add-doctor-success", (req, res) => {
    const msg1 = req.query.msg || "Doctor added successfully!";
    const name = req.query.name || "";
    const speciality = req.query.specialty || "";
    const number = req.query.phone || "";
    const email = req.query.email || "";
    const exp = req.query.yearsOfExp || "";
    const salary = req.query.salary || "";

    res.render("add_doctor_msg.ejs", { msg1, name, speciality, number, email, exp, salary });
});



app.post("/add_patient", async (req, res) => {
    try {
        await db.query(
            "INSERT INTO patient_admitted (name, age, gender, phone_number, join_date, join_time) VALUES ($1, $2, $3, $4, $5, $6)",
            [req.body.name, req.body.age, req.body.gender, req.body.phone, req.body.join_date, req.body.join_time]
        );
        const result = await db.query("select id from patient_admitted where phone_number=($1) and name=($2)",
            [req.body.phone, req.body.name]);
        const id = result.rows[0].id;
        const amount = 0;
        await db.query("insert into bill values ($1,$2)",
            [id, amount]);
        
        // Pass the message as a query parameter to the GET request
        res.redirect(`/add-patient-success?msg=${encodeURIComponent("Patient was successfully admitted!")}`);
    } catch (error) {
        console.error("Error adding patient:", error);
        res.status(500).send("<div style='font-size: 20px;'>An error occurred while adding the patient.</div>");
    }
});

// Display success message
app.get("/add-patient-success", (req, res) => {
    // Retrieve the message from the query parameter
    const msg = req.query.msg;
    res.render("add_patient_msg.ejs", { msg });
});



app.get('/delete-doctor/:id', async (req, res) => {
    var doctorId = req.params.id;
    // Perform any necessary deletion logic here
    await db.query("DELETE FROM doctor WHERE id = $1", [doctorId]);
    res.render("delete_doctor_msg.ejs");
});


app.get("/Services",(req,res)=>{
    res.render("services.ejs");
});

app.get("/About",(req,res)=>{
    res.render("about.ejs");
});

app.get("/Contact",(req,res)=>{
  res.render("contact.ejs");
});

app.get("/Appointment",async(req,res)=>{
    const weeks = generateWeeks();
    var doctors = await getDoctors();
    res.render("index.ejs", { weeks: weeks, today: today, getMonthName: getMonthName, doctors: doctors });
});

app.post("/select-department", async (req, res) => {
    date=req.body["date"];
    doctor_id=req.body["selectedDoctorId"];
    const result=await db.query("SELECT * FROM appointment WHERE a_date=($1) AND doctor_id=($2) ",
     [date,doctor_id]
    );
    var selectedTimes=[];
    result.rows.forEach(obj=>{
        selectedTimes.push(obj.a_time);
    });
    patient_name=req.body["name"];
    age=req.body["age"];
    phone_no=req.body["phone"];
    gender=req.body["gender"];
    res.render("index1.ejs",{selectedTimes:selectedTimes});
});

app.post("/select-time", async (req, res) => {
    try {
        const time = req.body["time"];
        // Assuming doctor_id, date, patient_name, age, gender, phone_no are properly defined elsewhere
        await db.query("INSERT INTO appointment VALUES ($1,$2,$3)", [doctor_id, date, time]);
        await db.query("INSERT INTO appointment_patient (name, age, gender, phone_number, doctor_id, a_date, a_time) VALUES ($1,$2,$3,$4,$5,$6,$7)", [patient_name, age, gender, phone_no, doctor_id, date, time]);
        
        
        res.redirect("/appointment-success");
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});

// Display success message
app.get("/appointment-success", (req, res) => {
    res.render("appointment_msg.ejs");
});


app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});


