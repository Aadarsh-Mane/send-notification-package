import { google } from "googleapis";
import express from "express";
import axios from "axios";
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file
const PORT = process.env.PORT || 5000;
const app = express();
const router = express.Router();

app.use(express.json()); // Parse JSON-encoded bodies
app.use(express.urlencoded({ extended: true }));
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.projectid,
    clientEmail: process.env.client_email,

    privateKey: process.env.private_key,
  }),
  // Replace with your Firebase project config
  databaseURL: "https://myschool-44d2f.firebaseio.com/",
});
export const getAccessToken = async () => {
  const jwtClient = new google.auth.JWT(
    process.env.client_email,
    null,
    process.env.private_key,
    ["https://www.googleapis.com/auth/firebase.messaging"], // Scope required for FCM
    null
  );

  try {
    const tokens = await jwtClient.authorize();
    // console.log("this  :"+tokens.access_token)
    return tokens.access_token;
  } catch (err) {
    res.json({ error: err });
    console.error("Error fetching access token:", err);
    return null;
  }
};
router.post("/send-notification-all", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    // Retrieve all FCM tokens from Firestore
    const querySnapshot = await firestore.collection("fcmtokens").get();
    const tokens = [];
    querySnapshot.forEach((doc) => {
      tokens.push({ id: doc.id, token: doc.data().token });
    });

    // Initialize counters for sent and invalid tokens
    let successfulNotifications = 0;
    let invalidTokens = 0;

    // Iterate through each token and send notification
    for (let i = 0; i < tokens.length; i++) {
      const message = {
        message: {
          token: tokens[i].token, // Use the current token in the iteration
          notification: {
            title: req.body.title,
            body: req.body.body,
          },
        },
      };

      try {
        // Send request to FCM API for current token
        const response = await axios.post(
          `https://fcm.googleapis.com/v1/projects/${process.env.projectid}/messages:send`,
          message,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(`Notification sent to token ${tokens[i].token}`);
        successfulNotifications++;
      } catch (error) {
        console.error(
          `Error sending to token ${tokens[i].token}:`,
          error.response ? error.response.data : error.message
        );

        // Check if the error indicates the token is invalid
        if (
          error.response &&
          (error.response.data.error.code === 404 ||
            error.response.data.error.message.includes(
              "registration token is not a valid FCM registration token"
            ))
        ) {
          // Remove invalid token from Firestore
          await firestore.collection("fcmtokens").doc(tokens[i].id).delete();
          console.log(`Removed invalid token ${tokens[i].token}`);
          invalidTokens++;
        }
      }
    }

    // Return summary of the notification sending process
    res.json({
      message: "Notification process completed",
      successfulNotifications: successfulNotifications,
      invalidTokens: invalidTokens,
    });
  } catch (error) {
    console.error(
      "Error sending notifications to all devices:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// app.get("/", (req, res) => {
//     console.log("hello")
// res.json({messafe:"hello"})
// console.log("hello")
// });
app.get("/", (req, res) => {
  console.log("Received GET request at /");

  res.json({ message: "Server is running" });
});
// checking port on local server
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
