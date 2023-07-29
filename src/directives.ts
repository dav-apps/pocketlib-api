import { defaultFieldResolver } from "graphql"
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils"
import { User } from "./types.js"
import { throwApiError } from "./utils.js"
import * as Errors from "./errors.js"
import { admins } from "./constants.js"
import { getTableObject } from "./services/apiService.js"

export const authDirectiveTransformer = (schema, directiveName) => {
	return mapSchema(schema, {
		[MapperKind.OBJECT_FIELD]: fieldConfig => {
			const authDirective = getDirective(schema, fieldConfig, directiveName)

			if (authDirective) {
				const { resolve = defaultFieldResolver } = fieldConfig
				const { role } = authDirective[0]

				fieldConfig.resolve = async (parent, args, context, info) => {
					const user: User = context.user
					const userRole = role == "USER"
					const authorRole = role == "AUTHOR"
					const adminRole = role == "ADMIN"

					if (user == null && (userRole || authorRole || adminRole)) {
						throwApiError(Errors.notAuthenticated)
					}

					if (user != null && adminRole && !admins.includes(user.id)) {
						throwApiError(Errors.actionNotAllowed)
					}

					if (user != null && authorRole && !admins.includes(user.id)) {
						let throwError = false

						// Get the parent table object
						let tableObject = await getTableObject(parent.uuid)

						if (tableObject == null) {
							throwError = true
						}

						if (tableObject != null) {
							// Check if the table object belongs to the user
							if (user.id != tableObject.userId) {
								throwError = true
							}
						}

						if (throwError) {
							throwApiError(Errors.actionNotAllowed)
						}
					}

					return await resolve(parent, args, context, info)
				}

				return fieldConfig
			}
		}
	})
}
