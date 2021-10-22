export async function handle(state, action) {
  const caller = action.caller;
  const input = action.input;

  const balances = state.balances;

  const ERROR_POLL_ALREADY_CREATED = "poll's creation is already used";
  const ERROR_INVALID_PRIMITIVE_TYPE =
    "an invalid primitive type has been seeded";
  const ERROR_INVALID_STRING_LENGTH =
    "the string's length is not between the allowed limits";
  const ERROR_POLL_LENGTH_TOO_LOW = "poll's length must be at least 24h";
  const ERROR_INVALID_CALLER = "unpermissioned caller";
  const ERROR_POLL_NOT_LAUNCHED = "poll has not been created";
  const ERROR_CHOICE_NOT_DEFINED = "the given choice is not defined";
  const ERROR_CALLER_ALREADY_VOTED = "the caller has already voted";
  const ERROR_POLL_CLOSED = "the poll reached the deadline";
  const ERROR_INVALID_TRANSFER_AMOUNT =
    "this aNFT does not support fractional ownership";
  const ERROR_UNSUFFICIENT_BALANCE = "the caller does not have balance";
  const ERROR_INVALID_TARGET = "the input cannot be used as target";

  if (input.function === "createPoll") {
    const title = input.title;
    const description = input.description;
    const len = input.len;
    const options = input.options;

    if (state.isRedeemed) {
      throw new ContractError(ERROR_POLL_ALREADY_CREATED);
    }

    _validateStringTypeLen(title, 3, 50);
    _validateStringTypeLen(description, 0, 75);
    _validateStringTypeLen(options, 2, 100);
    _validatePollPeriod(len);
    _validatePollOwner(caller);

    const pollOptions = options.split(",").map((str) => str.trim());

    state.poll = {
      proposedBy: caller,
      title: title,
      description: description,
      length: len,
      options: pollOptions,
      deadline: SmartWeave.block.height + len,
    };

    state.voters = [];

    const pollChoicesInit = pollOptions.map((opt) => [opt, 0]);

    state.choices = Object.fromEntries(pollChoicesInit);
    state.isRedeemed = true;

    return { state };
  }

  if (input.function === "vote") {
    const choice = input.choice;

    _checkPollAvailabily();
    _validateChoice(choice);
    _validateVoter(caller);

    state.choices[choice] += 1;
    state.voters.push(caller);

    return { state };
  }

  if (input.function === "transfer") {
    const target = input.target;
    const qty = input.qty;

    _validateQty(qty);
    _validateTarget(target, caller);
    _validateTransfer(qty, caller);

    balances[caller] -= qty;

    if (!balances[target]) {
      balances[target] = 0;
    }

    balances[target] += qty;
    state.owner = target;

    return { state };
  }

  if (input.function === "balance") {
    if (!input.address) {
      input.address = caller;
    }

    if (typeof address !== "string" || address.length !== 43) {
      throw new ContractError(ERROR_INVALID_TARGET);
    }

    const amount = address in balances ? balances[address] : 0;

    return {
      result: {
        balance: amount,
      },
    };
  }

  function _validateQty(qty) {
    if (!Number.isInteger(qty)) {
      throw new ContractError(ERROR_INVALID_PRIMITIVE_TYPE);
    }

    if (qty !== 1) {
      throw new ContractError(ERROR_INVALID_TRANSFER_AMOUNT);
    }
  }

  function _validateTarget(target, caller) {
    if (typeof target !== "string" || target.length !== 43) {
      throw new ContractError(ERROR_INVALID_TARGET);
    }

    if (target === caller) {
      throw new ContractError(ERROR_INVALID_TARGET);
    }
  }

  function _validateTransfer(qty, address) {
    if (!balances[address]) {
      throw new ContractError(ERROR_UNSUFFICIENT_BALANCE);
    }

    if (qty !== balances[address]) {
      throw new ContractError(ERROR_INVALID_TRANSFER_AMOUNT);
    }
  }

  function _validateStringTypeLen(string, minLen, maxLen) {
    if (typeof string !== "string") {
      throw new ContractError(ERROR_INVALID_PRIMITIVE_TYPE);
    }

    if (string.length > maxLen || string.length < minLen) {
      throw new ContractError(ERROR_INVALID_STRING_LENGTH);
    }
  }

  function _validatePollPeriod(len) {
    if (!Number.isInteger(len)) {
      throw new ContractError(ERROR_INVALID_PRIMITIVE_TYPE);
    }

    if (len <= 720) {
      // poll length must be at least ~24h
      throw new ContractError(ERROR_POLL_LENGTH_TOO_LOW);
    }
  }

  function _validatePollOwner(address) {
    if (address !== state.owner) {
      throw new ContractError(ERROR_INVALID_CALLER);
    }
  }

  function _validateChoice(choice) {
    if (typeof choice !== "string") {
      throw new ContractError(ERROR_INVALID_PRIMITIVE_TYPE);
    }

    if (!state.poll.options.includes(choice)) {
      throw new ContractError(ERROR_CHOICE_NOT_DEFINED);
    }
  }

  function _checkPollAvailabily() {
    if (!state["poll"]) {
      throw new ContractError(ERROR_POLL_NOT_LAUNCHED);
    }

    if (state.poll.deadline < SmartWeave.block.height) {
      throw new ContractError(ERROR_POLL_CLOSED);
    }
  }

  function _validateVoter(address) {
    if (state.voters.includes(address)) {
      throw new ContractError(ERROR_CALLER_ALREADY_VOTED);
    }
  }
}
