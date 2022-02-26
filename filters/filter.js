export async function handle(state, action) {
  const input = action.input;
  const caller = action.caller;

  const rate_limit = state.rate_limit;
  const post_char_limit = state.post_char_limit;
  const representatives = state.representatives;
  const super_representatives = state.super_representatives;

  const ERROR_INVALID_NFT_SRC = "post's NFT SRC is not supported";
  const ERROR_PID_NOT_EXIST = "the given PID not found";
  const ERROR_INVALID_REPLY_TYPE = "reply's type must be of type 'post'";
  const ERROR_USER_ADDRESS_NOT_EXIST =
    "the given address has not interacted with the contract";
  const ERROR_USER_ALREADY_SUSPENDED =
    "user already suspended - duplicated action";
  const ERROR_USER_NEVER_REPORTED =
    "cannot suspend a user without at least a single report by a representative";
  const ERROR_INVALID_CHAR_LIMIT =
    "characters limit must be an integer greater than the min-safe limit";
  const ERROR_INVALID_RATE_LIMIT =
    "rate limit must be an integer less than the max-safe limit";
  const ERROR_INVALID_INPUT = "the function has been given an invalid argument";
  const ERROR_INVALID_PRIMITIVE_TYPE = "invalid primitive data type";
  const ERROR_INVALID_STRING_LENGTH =
    "the string surpass the allowed min-max limits";
  const ERROR_CONTENT_BODY_IS_NOT_JSON =
    "post content body is not a valid JSON";
  const ERROR_INVALID_ARWEAVE_ADDRESS_TRANSACTION =
    "the syntax of the string is not a valid Arweave address/TX";
  const ERROR_POST_OWNER_NOT_CALLER = "the PID owner is not the caller";
  const ERROR_INVALID_TX_TAG = "the TX has invalid TX tag(s)";
  const ERROR_INVALID_POST_STRUCTURE = "PID data structure is not valid";
  const ERROR_RATE_LIMIT = "user cannot post, has reached the rate limit";
  const ERROR_USER_SUSPENDED = "user cannot post, has been suspended";
  const ERROR_CALLER_NOT_REPRESENTATIVE =
    "only a representative address can invoke this function";
  const ERROR_REPORT_NOT_EXIST_OR_EXECUTED =
    "report ID does not exist or the report has been executed";
  const ERROR_CONTRACT_TEMPORARY_SEALED =
    "the filter contract is sealed temporary - users interactions are revoked automatically";

  if (input.function === "post") {
    const txid = input.txid;

    _checkSealing(state.is_sealed, caller);
    _validateArweaveAddress(txid);
    _checkPostDuplication(txid);
    // get TX tags & validate post ownership
    const tx_tags = await _getTransactionTags(txid, caller);

    const post_src = state.nfts_src[0];
    // const poll_src = state.nfts_src[1];
    let post_type; // post or poll

    _checkTagExistence(tx_tags, "App-Name", "SmartWeaveContract");
    _checkTagExistence(tx_tags, "App-Version", "0.3.0");
    _checkTagExistence(tx_tags, "Content-Type", "application/json");
    _checkTagExistence(tx_tags, "Protocol-Name", "DecentLand");
    _checkTagExistence(tx_tags, "Protocol-Action", "post");
    _checkTagExistence(tx_tags, "Tribus-ID", SmartWeave.contract.id);

    if (
      !tx_tags["Contract-Src"] ||
      !state.nfts_src.includes(tx_tags["Contract-Src"])
    ) {
      throw new ContractError(ERROR_INVALID_NFT_SRC);
    }

    await _checkPostStructure(txid);

    // if (tx_tags["Contract-Src"] === poll_src) {
    //   await _checkPollStructure(txid);
    //   post_type = "poll"
    // }

    if (!(caller in state.users)) {
      state.users[caller] = {
        last_interaction: 0,
        reports_count: 0,
        user_status: "OK",
      };
    }

    _checkUserStatus(caller);
    _checkUserRateLimit(caller);

    state.users[caller].last_interaction = SmartWeave.block.height;

    state.feed.push({
      pid: txid,
      type: "post", // hardcoded
      owner: caller,
      timestamp: SmartWeave.block.timestamp,
      replies: [],
    });

    return { state };
  }

  if (input.function === "reply") {
    const txid = input.txid;
    const post_id = input.post_id;

    _checkSealing(state.is_sealed, caller);
    _validateArweaveAddress(txid);
    _checkPostDuplication(txid);

    const post_id_index = state.feed.findIndex((post) => post.pid === post_id);
    const post_type = _getPostType(post_id);

    if (post_id_index === -1) {
      throw new ContractError(ERROR_PID_NOT_EXIST);
    }

    // get TX tags & validate post ownership
    const tx_tags = await _getTransactionTags(txid, caller);

    const post_src = state.nfts_src[0];

    _checkTagExistence(tx_tags, "App-Name", "SmartWeaveContract");
    _checkTagExistence(tx_tags, "App-Version", "0.3.0");
    _checkTagExistence(tx_tags, "Content-Type", "application/json");
    _checkTagExistence(tx_tags, "Protocol-Name", "DecentLand");
    _checkTagExistence(tx_tags, "Protocol-Action", "reply");
    _checkTagExistence(tx_tags, "reply_to", post_id);
    _checkTagExistence(tx_tags, "Tribus-ID", SmartWeave.contract.id);

    if (
      !tx_tags["Contract-Src"] ||
      !state.nfts_src.includes(tx_tags["Contract-Src"])
    ) {
      throw new ContractError(ERROR_INVALID_NFT_SRC);
    }

    // reply can be type of 'post' only
    if (tx_tags["Contract-Src"] !== post_src) {
      throw new ContractError(ERROR_INVALID_REPLY_TYPE);
    }

    await _checkPostStructure(txid);

    if (!(caller in state.users)) {
      state.users[caller] = {
        last_interaction: 0,
        reports_count: 0,
        user_status: "OK",
      };
    }

    _checkUserStatus(caller);
    _checkUserRateLimit(caller);

    state.users[caller].last_interaction = SmartWeave.block.height;

    state.feed[post_id_index]["replies"].push({
      pid: txid,
      childOf: post_id,
      owner: caller,
      timestamp: SmartWeave.block.timestamp,
    });

    return { state };
  }

  // REPRESENTATIVES ACTIONS
  if (input.function === "report_post") {
    const pid = input.pid;
    const message = input.message;

    _isRepresentative(caller);

    const is_post = state.feed.find((post) => post["pid"] === pid);

    if (!is_post) {
      throw new ContractError(ERROR_PID_NOT_EXIST);
    }

    const report_index = state.reports.findIndex(
      (report) =>
        report.type === "post_report" &&
        report["pid"] === pid &&
        !report?.reporters?.includes(caller)
    );

    if (report_index !== -1) {
      const report = state.reports[report_index];
      report.reporters.push(caller);
      reports_count += 1;

      return { state };
    }

    state.reports.push({
      report_id: SmartWeave.transaction.id,
      pid: pid,
      type: "post_report",
      message: message,
      reporters: [caller],
      reports_count: 0,
    });

    return { state };
  }
  // SUPER REPRESENTATIVE ACTIONS
  if (input.function === "execute_report") {
    const report_id = input.report_id;

    _isSuperRepresentative(caller);

    const report_index = _getReportIndex(report_id);
    const report = state.reports[report_index];

    if (report["type"] === "post_report") {
      const pid = report["pid"];
      const post_index = state.feed.findIndex((post) => post["pid"] === pid);
      const post_owner = state.feed[post_index]["owner"];

      state.feed.splice(post_index, 1);
      state.reports[report_index].status = "executed";
      state.users[post_owner]["reports_count"] += 1;

      return { state };
    }

    if (report["type"] === "reply_report") {
      const pid = report["pid"];
      const post_index = state.feed.findIndex((post) =>
        post["replies"].find((reply) => reply["pid"] === pid)
      );
      const reply_index = state.feed[post_index]["replies"].find(
        (reply) => reply["pid"] === pid
      );
      const post_owner =
        state.feed[post_index]["replies"][reply_index]["owner"];

      state.feed[post_index]["replies"].splice(reply_index, 1);
      state.reports[report_index].status = "executed";
      state.users[post_owner]["reports_count"] += 1;

      return { state };
    }

    return { state };
  }

  if (input.function === "suspend_user") {
    const user_address = input.user_address;

    _validateArweaveAddress(user_address);
    _isSuperRepresentative(caller);

    if (!state.users.user_address) {
      throw new ContractError(ERROR_USER_ADDRESS_NOT_EXIST);
    }

    if (state.users.user_address.user_status !== "OK") {
      throw new ContractError(ERROR_USER_ALREADY_SUSPENDED);
    }

    const user_reports_count = state.users.user_address.reports_count;
    const user_super_reports =
      state.users.user_address?.super_rep_reports_count;
    const super_rep_half_plus_one =
      Math.trunc(state.super_representatives.length / 2) + 1;

    // user must be reported by atleast a single representative
    if (user_reports_count === 0) {
      throw new ContractError(ERROR_USER_NEVER_REPORTED);
    }

    if (!user_super_reports) {
      state.users.user_address.super_rep_reports_count = 1;
      // executed if sup_rep count = 1
      if (user_super_reports >= super_rep_half_plus_one) {
        state.users.user_address.user_status = "SUSPENDED";
        return { state };
      }
      return { state };
    }

    if (user_super_reports < super_rep_half_plus_one) {
      state.users.user_address.super_rep_reports_count += 1;

      if (user_super_reports >= super_rep_half_plus_one) {
        state.users.user_address.user_status = "SUSPENDED";
        return { state };
      }

      return { state };
    }
    state.users.user_address.super_rep_reports_count += 1;
    state.users.user_address.user_status = "SUSPENDED";

    return { state };
  }

  if (input.function === "edit_characters_limit") {
    const new_char_limit = input.new_char_limit;
    const safe_minimum_limit = 280;

    _isSuperRepresentative(caller);

    if (
      !Number.isInteger(new_char_limit) ||
      new_char_limit < safe_minimum_limit
    ) {
      throw new ContractError(ERROR_INVALID_CHAR_LIMIT);
    }

    state.post_char_limit = new_limit;

    return { state };
  }

  if (input.function === "edit_rate_limit") {
    const new_rate_limit = input.new_rate_limit;
    // 30 blocks delay between every interaction;
    const safe_maximum_limit = 30;

    _isSuperRepresentative(caller);

    if (!Number.isInteger(new_rate_limit) || new_limit > safe_maximum_limit) {
      throw new ContractError(ERROR_INVALID_RATE_LIMIT);
    }

    state.rate_limit = new_rate_limit;

    return { state };
  }

  if (input.function === "edit_sealing") {
    const sealing = input.sealing;

    _isSuperRepresentative(caller);

    if (![true, false].includes(sealing)) {
      throw new ContractError(ERROR_INVALID_INPUT);
    }

    state.is_sealed = sealing;

    return { state };
  }

  if (input.function === "remove_representative") {
    const address = input.address;

    _isSuperRepresentative(caller);
    _isRepresentative(address);

    const representativeIndex = state.representatives.findIndex(address);
    state.representatives.splice(representativeIndex, 1);

    return { state };
  }

  // HELPER FUNCTIONS
  function _validateStringTypeLen(str, minLen, maxLen) {
    if (typeof str !== "string") {
      throw new ContractError(ERROR_INVALID_PRIMITIVE_TYPE);
    }

    if (str.length < minLen || str.length > maxLen) {
      throw new ContractError(ERROR_INVALID_STRING_LENGTH);
    }
  }

  function _validateArweaveAddress(str) {
    _validateStringTypeLen(str, 43, 43);

    const validity = /[a-z0-9_-]{43}/i.test(str);
    if (!validity) {
      throw new ContractError(ERROR_INVALID_ARWEAVE_ADDRESS_TRANSACTION);
    }
  }

  async function _getTransactionTags(txid, address) {
    const tags = {};
    const tx_object = await SmartWeave.unsafeClient.transactions.get(txid);
    const tx_owner_decoded =
      await SmartWeave.unsafeClient.wallets.ownerToAddress(tx_object.owner);
    const tx_tags = tx_object.get("tags");

    for (let tag of tx_tags) {
      const key = tag.get("name", { decode: true, string: true });
      const value = tag.get("value", { decode: true, string: true });

      tags[key] = value;
    }

    if (tx_owner_decoded !== address) {
      throw new ContractError(ERROR_POST_OWNER_NOT_CALLER);
    }

    return tags;
  }

  function _checkTagExistence(tags_object, key, value) {
    if (!(key in tags_object) || tags_object[key] !== value) {
      throw new ContractError(ERROR_INVALID_TX_TAG);
    }
  }

  function _checkPostDuplication(txid) {
    const post_existence = state.feed.find((post) => post.pid === txid);
    const reply_existence = state.feed.find((post) =>
      post["replies"].find((reply) => reply.pid === txid)
    );

    if (post_existence || reply_existence) {
      throw new ContractError(ERROR_PID_ALREADY_EXIST);
    }
  }

  function _get_data_type(data) {
    return Object.prototype.toString.call(data);
  }

  async function _checkPostStructure(txid) {
    const content_string = await SmartWeave.unsafeClient.transactions.getData(
      txid,
      { decode: true, string: true }
    );

    try {
      JSON.parse(content_string);
    } catch (error) {
      throw new ContractError(ERROR_CONTENT_BODY_IS_NOT_JSON);
    }

    const content_object = JSON.parse(content_string);

    const isObject = _get_data_type(content_object) === "[object Object]";
    const hasContent =
      content_object.content &&
      _get_data_type(content_object.content) === "[object String]";
    const hasMediaArray =
      content_object.media &&
      _get_data_type(content_object.media) === "[object Array]";
    const hasOnlyContentAndMedia = Object.keys(content_object).length === 2;
    const isEmptyPost =
      content_object?.content?.length + content_object?.media?.length === 0;
    const isContentBelowLimit =
      content_object.content?.length < post_char_limit;

    if (
      isObject &&
      hasContent &&
      hasMediaArray &&
      hasOnlyContentAndMedia &&
      isContentBelowLimit &&
      !isEmptyPost
    ) {
      return true;
    }

    throw new ContractError(ERROR_INVALID_POST_STRUCTURE);
  }

  function _checkUserRateLimit(address) {
    const current_blockheight = SmartWeave.block.height;
    const current_user_blockheight = state.users[address].last_interaction;
    const get_rate_limit = state.users[address]["rate_limit"]
      ? state.users[address]["rate_limit"]
      : state.rate_limit;

    if (!(current_user_blockheight < current_blockheight + get_rate_limit)) {
      throw new ContractError(ERROR_RATE_LIMIT);
    }
  }

  function _checkUserStatus(address) {
    const status = state.users[address].user_status;

    if (status !== "OK") {
      throw new ContractError(ERROR_USER_SUSPENDED);
    }
  }

  function _isRepresentative(address) {
    const is_rep = representatives.includes(address);

    if (!is_rep) {
      throw new ContractError(ERROR_CALLER_NOT_REPRESENTATIVE);
    }
  }

  function _isSuperRepresentative(address) {
    const is_rep = super_representatives.includes(address);

    if (!is_rep) {
      throw new ContractError(ERROR_CALLER_NOT_REPRESENTATIVE);
    }
  }

  function _getReportIndex(id) {
    // report.status is defined when the report get executed
    // not executed report have no status
    const index = state.reports.findIndex(
      (report) => report["report_id"] === id && report.status
    );

    if (index === -1) {
      throw new ContractError(ERROR_REPORT_NOT_EXIST_OR_EXECUTED);
    }
  }

  function _getPostType(post_id) {
    const post_index = state.feed.findIndex((post) => post.pid === post_id);
    if (post_index === -1) {
      throw new ContractError(ERROR_PID_NOT_EXIST);
    }

    return state.feed[post_index].type;
  }

  function _checkSealing(filter_sealing_state, address) {
    if (filter_sealing_state && !(address in state.users)) {
      throw new ContractError(ERROR_CONTRACT_TEMPORARY_SEALED);
    }
  }
}
