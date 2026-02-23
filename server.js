const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/premium_blog';

// ===================== MODELS =====================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const visitorSchema = new mongoose.Schema({ count: { type: Number, default: 0 } });
const Visitor = mongoose.model('Visitor', visitorSchema);

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', blogSchema);

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'info' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'open' },
  adminReply: { type: String, default: '' },
  repliedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

// ===================== INIT =====================
async function init() {
  try {
    const v = await Visitor.findOne();
    if (!v) await new Visitor({ count: 0 }).save();
    console.log('Init complete');
  } catch (err) {
    console.error('Init error:', err);
  }
}

// ===================== MongoDB Connect =====================
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    init();
  })
  .catch(err => console.error('MongoDB error:', err));

// ===================== HELPER =====================
async function sendNotification(userId, message, type = 'info') {
  await new Notification({ userId, message, type }).save();
}

// ===================== VISITOR =====================
app.post('/api/visitor/increment', async (req, res) => {
  try {
    const v = await Visitor.findOneAndUpdate({}, { $inc: { count: 1 } }, { new: true });
    res.json({ success: true, count: v.count });
  } catch { res.status(500).json({ success: false }); }
});

// ===================== AUTH =====================
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'সব field পূরণ করুন' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password কমপক্ষে ৬ অক্ষর হতে হবে' });
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, message: 'এই email দিয়ে আগেই account আছে' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await new User({ name, email, password: hashed }).save();
    await sendNotification(user._id, `স্বাগতম ${name}! আপনার account সফলভাবে তৈরি হয়েছে।`, 'success');
    res.json({ success: true, message: 'Account তৈরি হয়েছে! এখন login করুন।' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email ও password দিন' });
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ success: false, message: 'Email বা password সঠিক নয়' });
    if (user.isBanned)
      return res.status(403).json({ success: false, message: 'আপনার account suspend করা হয়েছে। Help Center-এ যোগাযোগ করুন।' });

    res.json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email, isVerified: user.isVerified }
    });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

// ===================== NOTIFICATIONS =====================
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(20);
    const unreadCount = await Notification.countDocuments({ userId: req.params.userId, isRead: false });
    res.json({ success: true, notifications, unreadCount });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/notifications/read/:userId', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.params.userId }, { isRead: true });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

// ===================== BLOGS =====================
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json({ success: true, blogs });
  } catch { res.status(500).json({ success: false }); }
});

app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Article পাওয়া যায়নি' });
    res.json({ success: true, blog });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/blogs', async (req, res) => {
  try {
    const { title, content, authorId, authorName } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title ও content দিন' });
    const blog = await new Blog({ title, content, authorId, authorName }).save();
    await sendNotification(authorId, `আপনার article "${title}" সফলভাবে প্রকাশিত হয়েছে।`, 'success');
    res.json({ success: true, message: 'Article প্রকাশিত হয়েছে!', blog });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Article পাওয়া যায়নি' });
    if (blog.authorId.toString() !== userId)
      return res.status(403).json({ success: false, message: 'আপনি এই article delete করতে পারবেন না' });
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Article delete হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

// ===================== HELP TICKETS =====================
app.post('/api/tickets', async (req, res) => {
  try {
    const { userId, userName, userEmail, subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject ও message দিন' });
    const ticket = await new Ticket({ userId, userName, userEmail, subject, message }).save();
    await sendNotification(userId, `আপনার support ticket "#${ticket._id.toString().slice(-6)}" সফলভাবে জমা হয়েছে। শীঘ্রই reply করা হবে।`, 'info');
    res.json({ success: true, message: 'Ticket জমা হয়েছে! শীঘ্রই reply আসবে।' });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.get('/api/tickets/user/:userId', async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch { res.status(500).json({ success: false }); }
});

// ===================== ADMIN =====================
const ADMIN_USERNAME = 'sourovofficial83@gmail.com';
const ADMIN_PASSWORD = '1727451230S@#';

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD)
    res.json({ success: true });
  else
    res.status(401).json({ success: false, message: 'Username বা password ভুল' });
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBlogs = await Blog.countDocuments();
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'open' });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const visitorDoc = await Visitor.findOne();
    res.json({ success: true, totalUsers, totalBlogs, totalTickets, openTickets, verifiedUsers, totalVisitors: visitorDoc?.count || 0 });
  } catch { res.status(500).json({ success: false }); }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name email isVerified isBanned createdAt');
    res.json({ success: true, users });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password কমপক্ষে ৬ অক্ষর হতে হবে' });
    const hashed = await bcrypt.hash(newPassword, 10);
    const user = await User.findByIdAndUpdate(userId, { password: hashed });
    if (!user) return res.status(404).json({ success: false, message: 'User পাওয়া যায়নি' });
    await sendNotification(userId, 'আপনার account-এর password admin কর্তৃক reset করা হয়েছে।', 'warning');
    res.json({ success: true, message: 'Password reset হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User পাওয়া যায়নি' });
    await Blog.deleteMany({ authorId: req.params.userId });
    await Notification.deleteMany({ userId: req.params.userId });
    await Ticket.deleteMany({ userId: req.params.userId });
    res.json({ success: true, message: 'User ও তার সব data delete হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/admin/verify-user/:userId', async (req, res) => {
  try {
    const { verified } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { isVerified: verified });
    if (!user) return res.status(404).json({ success: false, message: 'User পাওয়া যায়নি' });
    if (verified) {
      await sendNotification(req.params.userId, '🎉 অভিনন্দন! আপনার account সফলভাবে verified হয়েছে।', 'success');
    } else {
      await sendNotification(req.params.userId, 'আপনার account verification সরিয়ে নেওয়া হয়েছে।', 'warning');
    }
    res.json({ success: true, message: verified ? 'User verified হয়েছে' : 'Verification সরানো হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/admin/ban-user/:userId', async (req, res) => {
  try {
    const { ban } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { isBanned: ban });
    if (!user) return res.status(404).json({ success: false, message: 'User পাওয়া যায়নি' });
    if (ban) {
      await sendNotification(req.params.userId, '⚠️ আপনার account suspend করা হয়েছে। বিস্তারিত জানতে Help Center-এ যোগাযোগ করুন।', 'danger');
    } else {
      await sendNotification(req.params.userId, '✅ আপনার account-এর suspension তুলে নেওয়া হয়েছে।', 'success');
    }
    res.json({ success: true, message: ban ? 'User ban হয়েছে' : 'User unban হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.delete('/api/admin/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (blog) {
      await sendNotification(blog.authorId, `⚠️ আপনার article "${blog.title}" admin কর্তৃক remove করা হয়েছে।`, 'warning');
    }
    res.json({ success: true, message: 'Article delete হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.get('/api/admin/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json({ success: true, blogs });
  } catch { res.status(500).json({ success: false }); }
});

app.get('/api/admin/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/admin/tickets/:id/reply', async (req, res) => {
  try {
    const { reply } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { adminReply: reply, status: 'replied', repliedAt: new Date() },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket পাওয়া যায়নি' });
    await sendNotification(ticket.userId, `📩 আপনার support ticket "#${ticket._id.toString().slice(-6)}" এ admin reply করেছে।`, 'info');
    res.json({ success: true, message: 'Reply পাঠানো হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/admin/tickets/:id/close', async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
    if (ticket) {
      await sendNotification(ticket.userId, `✅ আপনার support ticket "#${ticket._id.toString().slice(-6)}" বন্ধ করা হয়েছে।`, 'info');
    }
    res.json({ success: true, message: 'Ticket বন্ধ হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/api/admin/notify', async (req, res) => {
  try {
    const { userId, message, type } = req.body;
    if (!userId || !message) return res.status(400).json({ success: false, message: 'User ও message দিন' });
    await sendNotification(userId, message, type || 'info');
    res.json({ success: true, message: 'Notification পাঠানো হয়েছে' });
  } catch { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server চালু আছে: http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
