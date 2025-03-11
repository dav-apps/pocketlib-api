import { defaultFieldResolver } from "graphql"
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils"
import { User, TableObjectsController, TableObjectResource } from "dav-js"
import { throwApiError } from "./utils.js"
import { apiErrors } from "./errors.js"
import { admins } from "./constants.js"

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
						throwApiError(apiErrors.notAuthenticated)
					}

					if (user != null && adminRole && !admins.includes(user.Id)) {
						throwApiError(apiErrors.actionNotAllowed)
					}

					if (user != null && authorRole && !admins.includes(user.Id)) {
						// Get the parent table object
						let retrieveTableObjectResponse =
							await TableObjectsController.retrieveTableObject(
								`
								user {
									id
								}
							`,
								{ uuid: parent.uuid }
							)

						if (Array.isArray(retrieveTableObjectResponse)) {
							throwApiError(apiErrors.actionNotAllowed)
						}

						let tableObject =
							retrieveTableObjectResponse as TableObjectResource

						// Check if the table object belongs to the user
						if (tableObject != null && user.Id != tableObject.user.id) {
							throwApiError(apiErrors.actionNotAllowed)
						}
					}

					return await resolve(parent, args, context, info)
				}

				return fieldConfig
			}
		}
	})
}
