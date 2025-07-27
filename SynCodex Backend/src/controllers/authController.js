import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import transporter from "../config/nodemailer.js";
import dotenv from "dotenv";
import { db } from "../config/firebase.js";
import crypto from "crypto";

dotenv.config();

// Generate JWT Token
export const generateToken = (user) => {
  return jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

// User Registration Function
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const userRef = db.collection("users").doc(email);
    const userSnapshot = await userRef.get();

    if (userSnapshot.exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await userRef.set({
      fullName,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    });

    await sendWelcomeEmail(email, fullName);

    res.status(201).json({
      message: "User registered successfully! Please login.",
      user: { fullName, email },
    });

  } catch (error) {
    console.error("Registration Error:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// Function to Send Welcome Email
const sendWelcomeEmail = async (email, fullName) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to SynCodex!",
      html: `
        <h2>Welcome, ${fullName}!</h2>
        <p>Thank you for joining SynCodex! We're excited to have you on board.</p>
        <p>Start exploring and coding now.</p>
        <p>Happy Coding! 🚀</p>
      `,
    });

    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error("❌ Email Sending Error:", error.message);
  }
};


export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userRef = db.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(400).json({ message: "User not found" });
    }

    const userData = userSnap.data();

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    const token = generateToken(userData);
    console.log(token);

    res.json({
      message: "Login successful",
      user: { fullName: userData.fullName, email: userData.email },
      token,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Refresh Token
export const refreshToken = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: "Unauthorized - No Refresh Token" });

  try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const newToken = generateToken({ email: decoded.email });
      res.cookie("token", newToken, { httpOnly: true, secure: true, sameSite: "Strict", maxAge: 3600000 });
      res.json({ accessToken: newToken });
  } catch (err) {
      return res.status(403).json({ message: "Invalid Refresh Token" });
  }
};

//forgot password function
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = Date.now() + 3600000;

    snapshot.forEach(async (doc) => {
      await doc.ref.update({ resetToken, resetTokenExpires });
    });

    await sendResetEmail(email, resetToken);

    return res.status(200).json({ message: "Reset email sent successfully" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//reset password email send function
const sendResetEmail = async (email, resetToken) => {
  const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset Request",
    html: `<p>You requested a password reset. Click the link below:</p>
           <a target="_blank" href="${resetLink}">${resetLink}</a>
           <p>This link will expire in 1 hour.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Reset email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

//reset password function
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("resetToken", "==", token).get();

    if (snapshot.empty) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    snapshot.forEach(async (doc) => {
      await doc.ref.update({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      });
    });

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//google login function
export const googleLogin = async (req, res) => {
  try {
      const { email, name, googleId } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const userRef = db.collection("users").doc(email);
      const userDoc = await userRef.get();

      let isFirstLogin = false;

      if (!userDoc.exists) {
          isFirstLogin = true;
          const hashedGoogleId = await bcrypt.hash(googleId, 10);
          await userRef.set({
              name,
              email,
              hashedGoogleId,
              createdAt: new Date(),
          });
      }

      const token = generateToken(email);

      if (isFirstLogin) {
          await sendWelcomeEmail(email, name);
      }

      res.json({
        message: "Login successful",
        user: { fullName: userDoc.exists ? userDoc.data().name : name, email },
        token,
      });

  } catch (error) {
    console.error("🔥 Google Login Error:", error);
    res.status(500).json({ error: "Login failed", details: error.message });
  }
};