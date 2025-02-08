import express from 'express';
import bcrypt from 'bcryptjs';
import UserService from '../service/UserService';

import * as dotenv from 'dotenv';
import verifyToken from "../middleware/token";
import ResponseHandler from "../utils/ResponseHandler";
import Validator from "../middleware/validator";
import {CreateUserDTO} from "../database/model/User";

const router = express.Router();
const userService = new UserService();

dotenv.config();

router.post('/user/register',
    Validator.classValidator(CreateUserDTO),
    async (req, res) => {

    try {
        const userDTO: CreateUserDTO = req.body;
        await userService.registerNewUser(userDTO);
        return ResponseHandler.success(res);
    } catch (error) {
        return ResponseHandler.error(res, undefined, undefined, error.toString());
    }
});

router.post('/user/login',
    Validator.classValidator(CreateUserDTO),
    async (req, res) => {

    try {
        const loginPayload: CreateUserDTO = req.body;
        const token = await userService.loginUser(loginPayload);
        return ResponseHandler.success(res, token);
    } catch (error) {
        return ResponseHandler.error(res, undefined, undefined, error.toString());
    }
});

router.get('/user/:id', verifyToken, async(
    req,
    res) => {
    const id = parseInt(req.params.id);

    if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
    }

    const user = await userService.getUserById(id);
    res.status(200).json(user);
});

router.get('/user/email/:email', verifyToken, async(
    req,
    res) => {
    const email = req.params.email;

    if (!email) {
        res.status(400).json({ error: 'email is required' });
        return
    }

    const user = await userService.getUserByEmail(email);
    res.status(200).json(user);
});

router.patch('/user/:id', verifyToken, async(
    req,
    res) => {
    const id = parseInt(req.params.id);

    if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
    }

    const { old_password, password } = req.body;

    if (!old_password || !password) {
        res.status(400).json({ error: 'password is required / old password must be specified' });
        return;
    }

    const existingUser = await userService.getUserById(id);
    if (!existingUser) {
        res.status(400).json({ error: 'user not found' });
        return;
    }

    const isPasswordValid = await bcrypt.compare(old_password, existingUser.password);
    if (!isPasswordValid) {
        res.status(400).json({ error: 'invalid old password' });
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userService.updateUserPasswordById(id, hashedPassword);
    res.json(user);
});

router.delete('/user/:id', verifyToken, async(
    req,
    res) => {
    const id = parseInt(req.params.id);
    const user = await userService.deleteUserById(id);
    res.json(user);
});

export default router;