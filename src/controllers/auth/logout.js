import User from "../../models/User.js";

export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  const user = await User.findOne({ where: { refreshToken } });
  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  res.sendStatus(204);
};
