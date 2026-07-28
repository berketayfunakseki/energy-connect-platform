import * as cdk from "aws-cdk-lib";
import { ConnectPlatformStack } from "../lib/connect-platform-stack";

const app = new cdk.App();
new ConnectPlatformStack(app, "ConnectPlatformStack");
