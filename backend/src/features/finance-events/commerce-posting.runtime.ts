import commercePostingService from "../ledger/commerce-posting.service";
import { PostingWorker } from "./posting-worker";

export const commercePostingWorker = new PostingWorker(commercePostingService);
