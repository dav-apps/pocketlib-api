import { retrieveOrder, updateOrder } from "../services/apiService.js"
import { getProducts } from "../services/vlbApiService.js"
import OrderSentEmail from "../emails/orderSent.js"
import {
	ResolverContext,
	QueryResult,
	List,
	StoreBook,
	VlbItem,
	Order
} from "../types.js"
import {
	findVlbItemByVlbGetProductsResponseDataItem,
	throwApiError,
	getVlbItemCoverUrl
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { admins, noReplyEmailAddress } from "../constants.js"

export async function search(
	parent: any,
	args: { query: string; limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<StoreBook | VlbItem>>> {
	let take = args.limit ?? 10
	if (take <= 0) take = 10

	let skip = args.offset ?? 0
	if (skip < 0) skip = 0

	let result = await getProducts({
		query: `${args.query.toLowerCase()} pt=pbook li=20`,
		page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
		size: take,
		active: true
	})

	let items: VlbItem[] = []

	for (let product of result.content) {
		items.push(
			await findVlbItemByVlbGetProductsResponseDataItem(
				context.prisma,
				product
			)
		)
	}

	return {
		caching: true,
		data: {
			total: result.totalElements,
			items
		}
	}
}

export async function completeOrder(
	parent: any,
	args: {
		orderUuid: string
	},
	context: ResolverContext
): Promise<Order> {
	// Check if the user is an admin
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	} else if (!admins.includes(context.user.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	let order = await retrieveOrder(
		`
			uuid
			status
			tableObject {
				uuid
			}
		`,
		{ uuid: args.orderUuid }
	)

	if (order == null) {
		throwApiError(apiErrors.orderDoesNotExist)
	}

	if (order.status == "SHIPPED") {
		return order
	} else if (order.status == "CREATED") {
		throwApiError(apiErrors.orderHasIncorrectState)
	}

	// Get the VlbItem from the database
	let vlbItem = await context.prisma.vlbItem.findFirst({
		where: { uuid: order.tableObject.uuid }
	})

	if (vlbItem == null) {
		throwApiError(apiErrors.vlbItemDoesNotExist)
	}

	// Update the order with status = SHIPPED
	let updatedOrder = await updateOrder(
		`
			uuid
			price
			user {
				email
			}
			shippingAddress {
				name
			}
		`,
		{
			uuid: args.orderUuid,
			status: "SHIPPED"
		}
	)

	if (updatedOrder == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Send order sent email
	let name = updatedOrder.shippingAddress.name?.split(" ")[0]
	let product = {
		title: vlbItem.title,
		price: `${(updatedOrder.price / 100).toFixed(2)} €`.replace(".", ","),
		coverUrl: getVlbItemCoverUrl(vlbItem.mvbId)
	}

	context.resend.emails.send({
		from: noReplyEmailAddress,
		to: updatedOrder.user.Email,
		subject: "Versandbestätigung - PocketLib",
		react: <OrderSentEmail name={name} product={product} />
	})

	return updatedOrder
}
