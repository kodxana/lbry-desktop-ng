// @flow

declare type PublishFee = Readonly<{ amount: string | number, currency: string, ... }>;

declare type PublishState = {
  editingURI: ?string,
  uri?: ?string,
  fileText: ?string,
  filePath: ?string,
  remoteFileUrl: ?string,
  contentIsFree: boolean,
  fileDur: number,
  fileSize: number,
  fileVid: boolean,
  fee: PublishFee,
  title: ?string,
  author?: string,
  thumbnail_url: string,
  thumbnail?: ?string,
  thumbnailPath: string,
  uploadThumbnailStatus: ?string,
  thumbnailError: ?boolean,
  description: ?string,
  language: string,
  languages?: Array<string>,
  releaseTime: ?number,
  releaseTimeEdited: ?number,
  channel: ?string,
  channelId: ?string,
  name: string,
  nameError: ?string,
  bid: number,
  bidError: ?string,
  licenseType: ?string,
  otherLicenseDescription: ?string,
  licenseUrl: ?string,
  tags: Array<Tag>,
  nsfw: boolean,
  isMarkdownPost?: boolean,
  publishing: boolean,
  publishSuccess: boolean,
  publishError: ?string,
  optimize: boolean,
  useLBRYUploader: boolean,
};

declare type UpdatePublishFormData = Partial<PublishState>;
declare type UpdatePublishFormAction = { type: string, data: UpdatePublishFormData };
declare type ThumbnailParams = { thumbnail_url?: string, thumbnail_error?: boolean, thumbnail_status?: ?string };
