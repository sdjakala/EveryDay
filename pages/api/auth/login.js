import loginHandler from "../../../api/auth/login.js";

export default function handler(req, res) {
  return loginHandler(req, res);
}
