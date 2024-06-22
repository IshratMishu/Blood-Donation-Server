const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 9000;
const jwt = require("jsonwebtoken");
require("colors");

// middleWare
app.use(
  cors({
    origin: ["http://localhost:5173", ""],
    credentials: true,
  })
);
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  // console.log(token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access " });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.telyg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
client
  .connect()
  .then(() => console.log("Connected to MongoDB".bold.blue))
  .catch((err) => console.log(err.red.bold));

async function run() {
  try {
    const db = client.db("vitalDB");
    const userCollection = db.collection("users");
    const donationRequestCollection = db.collection("donationRequest");
    const blogCollection = db.collection("blogs");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    const verifyAdminOrVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      const isVolunteer = user?.role === "volunteer";
      if (!isAdmin && !isVolunteer) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    // create blog
    app.post("/add-blog", async (req, res) => {
      const blog = req.body;
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    // get all blogs
    app.get("/all-blogs", async (req, res) => {
      const status = req.query.status;

      if (status !== "all") {
        const query = { status: status };
        const result = await blogCollection.find(query).toArray();
        return res.send(result);
      }
      const result = await blogCollection.find().toArray();
      res.send(result);
    });

    // get published blog
    app.get("/blogs", async (req, res) => {
      const query = { status: "published" };
      const result = await blogCollection.find(query).toArray();
      res.send(result);
    });

    // get blog details
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await blogCollection.findOne(query);
      res.send(result);
    });

    // delete blog
    app.delete("/delete-blog/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const result = await blogCollection.deleteOne(filter);
      res.send(result);
    });

    // update blog
    app.patch("/update-blog-status/:id", async (req, res) => {
      const id = req.params.id;
      const newStatus = req.body.status;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: newStatus,
        },
      };
      const result = await blogCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // create user public
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      console.log(userInfo);
      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });
    // get all users only admin
    app.get("/all-users", verifyToken, verifyAdmin, async (req, res) => {
      const status = req.query.status;
      if (status !== "all") {
        // console.log(status);
        const query = { status: status };
        const result = await userCollection.find(query).toArray();
        return res.send(result);
      }

      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // update userStatus only admin
    app.patch("/update-user-status/:id", async (req, res) => {
      const id = req.params.id;
      const newStatus = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: newStatus,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // update user role only admin
    app.patch("/update-user-role/:id", async (req, res) => {
      const id = req.params.id;
      const newRole = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: newRole,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get isAdmin user
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      // if (email !== req?.decoded?.email) {
      //     return res
      //         .status(403)
      //         .send({ message: "forbidden access" })
      // }
      const query = { email: email };
      const user = await userCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // get isVolunteer user
    app.get("/users/volunteer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);

      let volunteer = false;
      if (user) {
        volunteer = user?.role === "volunteer";
      }
      res.send({ volunteer });
    });

    // get user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // update user
    app.patch("/update-user/:id", async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...updatedUser,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // search user
    app.get("/search-user/:bloodGroup", async (req, res) => {
      const bloodGroup = req.params.bloodGroup;
      const search = req.query;
      const query = {
        bloodGroup: bloodGroup,
        district: search.district,
        upazila: search.upazila,
      };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // donationRequestCollection

    // get recent request {user}
    app.get(
      "/recent-donation-request/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        const query = {
          requester_email: email,
        };
        const result = await donationRequestCollection
          .find(query)
          .sort({ timeStamp: -1 })
          .toArray();

        res.send(result);
      }
    );

    // get all donation request admin or volunteer
    app.get(
      "/all-donation-request",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const status = req.query.status;
        if (status !== "all") {
          const query = { donation_status: status };
          const result = await donationRequestCollection.find(query).toArray();
          return res.send(result);
        }

        const result = await donationRequestCollection.find().toArray();
        res.send(result);
      }
    );

    // get my donation  all role
    app.get("/my-donation-request/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const status = req.query.status;
      if (status !== "all") {
        const query = {
          donation_status: status,
          requester_email: email,
        };
        const result = await donationRequestCollection.find(query).toArray();
        return res.send(result);
      }
      const query = { requester_email: email };
      const result = await donationRequestCollection.find(query).toArray();
      res.send(result);
    });

    // get donation request public
    app.get("/donation-request", async (req, res) => {
      const query = {
        donation_status: "pending",
      };
      const result = await donationRequestCollection.find(query).toArray();
      res.send(result);
    });

    //  get single donation request user
    app.get("/donation-request/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        donation_status: "pending",
        _id: new ObjectId(id),
      };
      const result = await donationRequestCollection.findOne(query);
      res.send(result);
    });

    //  get single donation request user for update
    app.get("/donation-request-byId/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await donationRequestCollection.findOne(query);
      res.send(result);
    });

    // donate {user} update donation status
    app.patch("/donate/:id", async (req, res) => {
      const id = req.params.id;
      const donorInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          donation_status: "inprogress",
          ...donorInfo,
        },
      };
      const result = await donationRequestCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // update donation request  role
    app.patch("/update-donation-request/:id", async (req, res) => {
      const id = req.params.id;
      const newDonorInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...newDonorInfo,
        },
      };
      const result = await donationRequestCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // update donation status all role
    app.patch("/done-cancel/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.query.status;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          donation_status: status,
        },
      };
      const result = await donationRequestCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    //  delete donation request
    app.delete("/delete-request/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const result = await donationRequestCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/donation-request", async (req, res) => {
      const requestInfo = req.body;
      const result = await donationRequestCollection.insertOne(requestInfo);
      res.send(result);
    });

    // stats and analytics
    app.get("/admin-stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const requests = await donationRequestCollection.estimatedDocumentCount();

      res.send({
        users,
        requests,
      });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("One Blood Server is running");
});

app.listen(port, () => {
  console.log(`One Blood Server is Running Port: ${port}`.bold.yellow);
});
