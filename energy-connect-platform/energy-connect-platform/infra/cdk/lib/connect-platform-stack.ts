import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as rds from "aws-cdk-lib/aws-rds";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

export class ConnectPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    const database = new rds.DatabaseInstance(this, "Postgres", {
      vpc,
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      multiAz: false,
      publiclyAccessible: false,
      databaseName: "connect",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Api", {
      cluster,
      desiredCount: 2,
      publicLoadBalancer: true,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset("../..", { file: "Dockerfile" }),
        containerPort: 8080,
        environment: {
          PORT: "8080",
          DB_HOST: database.dbInstanceEndpointAddress,
          DB_PORT: database.dbInstanceEndpointPort,
          DB_NAME: "connect",
        },
        secrets: {
          DB_USER: ecs.Secret.fromSecretsManager(database.secret!, "username"),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, "password"),
        },
      },
    });

    api.targetGroup.configureHealthCheck({ path: "/health" });
    database.connections.allowDefaultPortFrom(api.service);

    const workerTask = new ecs.FargateTaskDefinition(this, "WorkerTask", { cpu: 256, memoryLimitMiB: 512 });
    const workerContainer = workerTask.addContainer("Worker", {
      image: ecs.ContainerImage.fromAsset("../..", { file: "Dockerfile.worker" }),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "connect-worker" }),
      environment: {
        DB_HOST: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        DB_NAME: "connect",
        WORKER_POLL_MS: "500",
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(database.secret!, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, "password"),
      },
    });
    const workerService = new ecs.FargateService(this, "WorkerService", {
      cluster,
      taskDefinition: workerTask,
      desiredCount: 2,
    });
    database.connections.allowDefaultPortFrom(workerService);

    const apiScaling = api.service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 10 });
    apiScaling.scaleOnCpuUtilization("ApiCpuScaling", { targetUtilizationPercent: 60 });

    const workerScaling = workerService.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 20 });
    workerScaling.scaleOnCpuUtilization("WorkerCpuScaling", { targetUtilizationPercent: 65 });

    new cloudwatch.Alarm(this, "ApiCpuHigh", {
      metric: api.service.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: "API CPU remains high; inspect latency and scale state.",
    });

    new cloudwatch.Alarm(this, "DatabaseConnectionsHigh", {
      metric: database.metricDatabaseConnections(),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: "PostgreSQL connection pressure is high.",
    });

    new cdk.CfnOutput(this, "LoadBalancerDns", { value: api.loadBalancer.loadBalancerDnsName });
  }
}
