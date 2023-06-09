const generateToken = require("../../config/token/generateToken")
const User = require("../../model/user/User")
const expressAsyncHandler = require("express-async-handler")
const validateMongodbId = require("../../utils/validateMongoDBId")
const sendEmail = require("../../utils/sendEmail")
const crypto = require('crypto')

// REGISTER
const userRegisterCtrl = expressAsyncHandler(async (req, res) => {
    const { email } = req.body
    
    // check if the user is already registered
    const userExists = await User.findOne({email})

    if (userExists) throw new Error("User already registered")
    
    try {
        // register user
        const user = await User.create({
            firstName: req?.body?.firstName,
            lastName: req?.body?.lastName,
            email: req?.body?.email,
            password: req?.body?.password,
        })
        res.json(user)
    } catch (error) {
        res.json(error)
    }

})


// Generate email verification
const generateVerificationTokenCtrl = expressAsyncHandler (async (req, res) => {
    const loginUserId = req.user.id
    const user = await User.findById(loginUserId)
    try {
        // generate token
        const verificationToken = await user.createAccountVerificationToken()

        // save the user
        await user.save()
        
        const resetURL = `If you were requested to verify your account, verify now within 10 minutes, otherwise ignore this message. <a href="http://localhost:3000/verify-account/${verificationToken}">Click to verify</a>`
        
        // build message
        const to = "arifpatanduk2@gmail.com"
        const subject = "Verify Account"
        const html = resetURL
        
        sendEmail(to, subject, html)
        res.json(html)

    } catch (error) {
        console.log(error);
    }
})


// Account Verification
const accountVerification = expressAsyncHandler (async (req, res) => {
    const { token } = req.body
    const hashedToken = crypto.createHash('sha256').update(token).digest("hex")
    
    // find user by token
    const userFound = await User.findOne({
        accountVerificationToken: hashedToken,
        accountVerificationExpires: {$gt: new Date()}
    })

    if (!userFound) throw new Error ("Token Expired, try again later")

    // update the account verification property
    userFound.isAccountVerified = true
    userFound.accountVerificationToken = undefined
    userFound.accountVerificationExpires = undefined

    await userFound.save()
    res.json({
        message: 'Account verified successfully',
        data: userFound
    })
})


// FORGET PASSWORD Token Generator
const forgetPasswordToken = expressAsyncHandler(async(req, res) => {
    const { email } = req.body

    // find user by email
    const user = await User.findOne({ email })
    
    // if user is not found
    if (!user) throw new Error('User not found')

    // if user is found
    try {
        const token = await user.createForgetPasswordToken()
        await user.save()

        // build message
        const resetURL = `If you were requested to reset your password, reset now within 10 minutes, otherwise ignore this message. <a href="http://localhost:3000/reset-password/${token}">Click to verify</a>`
        
        const to = email
        const subject = "Reset Password"
        const html = resetURL
        await sendEmail(to, subject, html)

        res.json({
            message: `A verification email has been sent to ${to}. Reset now within 10 minutes, otherwise ignore this message. <a href="http://localhost:3000/reset-password/${token}">Click to verify`
        })
    } catch (error) {
        console.log(error);
    }
})


// PASSWORD RESET 
const passwordResetCtrl = expressAsyncHandler(async (req, res) => {
    const {token, password} = req.body
    const hashedToken = crypto.createHash('sha256').update(token).digest("hex")

    // find user by token
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: {$gt: new Date()}
    })

    if (!user) throw new Error("Token expired, try again later")

    // update the password
    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.json({
        message: "Password updated successfully",
        data: user
    })
}) 



// LOGIN
const userLoginCtrl = expressAsyncHandler(async (req, res) => {

    const { email, password } = req.body

    // check if user exists
    const user = await User.findOne({ email })
    
    // check if password is matched
    if (user && await user.isPasswordMatched(password)) {
        res.json({
            _id: user?._id,
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
            profilePhoto: user?.profilePhoto,
            isAdmin: user?.isAdmin,
            token: generateToken(user?._id)
        })
    } else {
        res.status(401)
        throw new Error('Invalid Login Credentials')
    }
})

// 


// USERS

// user details
const userDetailCtrl = expressAsyncHandler(async (req, res) => {
    const { id } = req.params
    validateMongodbId(id)
    try {
        const user = await User.findById(id)
        res.json(user)
    } catch (error) {
        res.json(error)
    }
})

// fetch all users
const fetchUsersCtrl = expressAsyncHandler(async (req, res) => {
    try {
        const users = await User.find({})
        res.json(users)
    } catch (error) {
        res.json(error)
    }
})

// delete user
const deleteUserCtrl = expressAsyncHandler(async (req, res) => {
    const { id } = req.params
    validateMongodbId(id)

    try {
        const user = await User.findByIdAndDelete(id)
        res.json(user)
    } catch (error) {
        res.json(error)
    }
})

// USER PROFILE
// show user profile
const userProfileCtrl = expressAsyncHandler(async (req, res) => {
    const { id } = req.params
    validateMongodbId(id)
    try {
        const user = await User.findById(id)
        res.json(user)
    } catch (error) {
        res.json(error)
    }
})

// update user profile
const userUpdateProfileCtrl = expressAsyncHandler(async (req, res) => {
    const { _id } = req?.user
    validateMongodbId(_id)

    const user = await User.findByIdAndUpdate(_id, {
        firstName: req?.body?.firstName,
        lastName: req?.body?.lastName,
        email: req?.body?.email,
        bio: req?.body?.bio
    }, {
        new: true,
        runValidators: true
    })

    res.json(user)
})

// update user password
const userUpdatePasswordCtrl = expressAsyncHandler(async (req, res) => {
    const { _id } = req?.user
    const { password } = req?.body
    validateMongodbId(_id)

    const user = await User.findById(_id)

    if (password) {
        user.password = password
        const updatedUser = await user.save()
        res.json(updatedUser)
    }
    
    res.json(user)
})


// FOLLOWING
// follow
const userFollowingCtrl = expressAsyncHandler(async (req, res) => {
    const { followId } = req?.body
    const loginUserId = req?.user.id

    // validate followId
    validateMongodbId(followId)
    const targetUser = await User.findById(followId)

    const alreadyFollowing = targetUser?.followers?.find(
        follower => follower?.toString() === loginUserId.toString()
    )

    if (alreadyFollowing) throw new Error(`You already followed ${targetUser?.firstName} ${targetUser?.lastName}`)
    
    // update follower in target user
    await User.findByIdAndUpdate(followId, {
        $push: {followers: loginUserId},
        isFollowing: true
    }, { new: true })
    
    // update following in current user
    await User.findByIdAndUpdate(loginUserId, {
        $push: {following: followId}
    }, { new: true })

    res.json(`You have successfully followed ${targetUser?.firstName} ${targetUser?.lastName}`)
})


// unfollow
const userUnfollowingCtrl = expressAsyncHandler(async (req, res) => {
    const { unfollowId } = req?.body
    const loginUserId = req?.user.id

    // validate followId
    validateMongodbId(unfollowId)
    const targetUser = await User.findById(unfollowId)

    const alreadyFollowing = targetUser?.followers?.find(
        follower => follower?.toString() === loginUserId.toString()
    )

    if (!alreadyFollowing) throw new Error(`You not following ${targetUser?.firstName} ${targetUser?.lastName}`)

    // remove follower in target user
    await User.findByIdAndUpdate(unfollowId, {
        $pull: {followers: loginUserId},
        isFollowing: false
    }, { new: true })
    
    // remove following in current user
    await User.findByIdAndUpdate(loginUserId, {
        $pull: {following: unfollowId}
    }, { new: true })

    res.json(`You have successfully unfollow ${targetUser?.firstName} ${targetUser?.lastName}`)
})


// BLOCK USER
// block
const userBlockCtrl = expressAsyncHandler(async (req, res) => {
    const { id } = req?.params
    validateMongodbId(id)

    const user = await User.findByIdAndUpdate(id, {
        isBlocked: true
    }, { new: true })

    res.json(user)
})

// unblock
const userUnblockCtrl = expressAsyncHandler(async (req, res) => {
    const { id } = req?.params
    validateMongodbId(id)

    const user = await User.findByIdAndUpdate(id, {
        isBlocked: false
    }, { new: true })

    res.json(user)
})

module.exports = {
    userRegisterCtrl, 
    generateVerificationTokenCtrl,
    accountVerification,
    forgetPasswordToken,
    passwordResetCtrl,
    userLoginCtrl, 
    fetchUsersCtrl, 
    deleteUserCtrl, 
    userDetailCtrl,
    userProfileCtrl,
    userUpdateProfileCtrl,
    userUpdatePasswordCtrl,
    userFollowingCtrl,
    userUnfollowingCtrl,
    userBlockCtrl,
    userUnblockCtrl
}