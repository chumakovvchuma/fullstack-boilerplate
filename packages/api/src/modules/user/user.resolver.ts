import { Resolver, Query, Ctx, Mutation, Arg, Authorized } from "type-graphql"

import { ResolverContext } from "../../lib/types"
import { createToken, decryptToken } from "../../lib/jwt"

import { User } from "./user.entity"
import { UserService } from "./user.service"
import { UserMailer } from "./user.mailer"
import { RegisterInput, LoginInput, UpdateInput } from "./user.input"
import { ResetPasswordInput } from "./inputs/resetPassword.input"
import { cookieName } from "../../lib/config"
import { UserRepository } from "./user.repository"

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,

    private readonly userMailer: UserMailer,
  ) {}

  // ME
  @Authorized()
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: ResolverContext): Promise<User> {
    return await this.userRepository.findById(req.session.user.id)
  }

  // REGISTER
  @Mutation(() => User)
  async register(
    @Arg("data") data: RegisterInput,
    @Ctx() { req }: ResolverContext,
  ): Promise<User> {
    const user = await this.userService.create(data)
    if (req.session) req.session.user = user
    this.userMailer.sendWelcomeEmail(user)
    return user
  }

  // LOGIN
  @Mutation(() => User)
  async login(
    @Arg("data") data: LoginInput,
    @Ctx() { req }: ResolverContext,
  ): Promise<User> {
    const user = await this.userService.login(data)
    req.session!.user = user // eslint-disable-line
    return user
  }

  // UPDATE USER
  @Authorized()
  @Mutation(() => User, { nullable: true })
  async updateUser(
    @Arg("data") data: UpdateInput,
    @Ctx()
    { req }: ResolverContext,
  ): Promise<User> {
    return this.userService.update(req.session.user.id, data)
  }

  // LOGOUT
  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: ResolverContext): Promise<boolean> {
    await new Promise(res => {
      if (req.session) req.session.destroy(() => res())
    })
    res.clearCookie(cookieName)
    return true
  }

  // FORGOT PASSWORD
  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string): Promise<boolean> {
    const user = await this.userRepository.findByEmail(email)
    if (!user) throw new Error("user not found")
    const token = await createToken({ id: user.id })
    this.userMailer.sendResetPasswordLink(user, token)
    return true
  }

  // RESET PASSWORD
  @Mutation(() => Boolean)
  async resetPassword(@Arg("data")
  {
    token,
    password,
  }: ResetPasswordInput): Promise<boolean> {
    const payload = await decryptToken<{ id: string }>(token)
    await this.userService.update(payload.id, { password })
    return true
  }
}